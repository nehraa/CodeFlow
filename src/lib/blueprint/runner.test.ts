import { beforeEach, describe, expect, it, vi } from "vitest";

const { prepareRuntimeWorkspaceMock } = vi.hoisted(() => ({
  prepareRuntimeWorkspaceMock: vi.fn()
}));

vi.mock("@/lib/blueprint/runtime-workspace", () => ({
  prepareRuntimeWorkspace: prepareRuntimeWorkspaceMock
}));

import { runBlueprint } from "@/lib/blueprint/runner";
import type { BlueprintGraph, MaterializedBlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";
import { prepareRuntimeWorkspace } from "@/lib/blueprint/runtime-workspace";

const createBaseGraph = (): MaterializedBlueprintGraph => ({
  projectName: "Runtime Graph",
  mode: "essential",
  phase: "integration",
  generatedAt: "2026-03-26T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [],
  nodes: [
    {
      id: "function:produce",
      kind: "function",
      name: "produce",
      summary: "Produce a numeric payload.",
      contract: {
        ...emptyContract(),
        summary: "Produce a numeric payload.",
        outputs: [{ name: "value", type: "number" }]
      },
      status: "spec_only",
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "function:consume",
      kind: "function",
      name: "consume",
      summary: "Consume a string payload.",
      contract: {
        ...emptyContract(),
        summary: "Consume a string payload.",
        inputs: [{ name: "value", type: "string" }],
        outputs: [{ name: "ok", type: "boolean" }]
      },
      status: "spec_only",
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runBlueprint", () => {
  it("records graph-wide pass/fail/block evidence when a required handoff fails", async () => {
    const graph: MaterializedBlueprintGraph = {
      ...createBaseGraph(),
      edges: [
        {
          from: "function:produce",
          to: "function:consume",
          kind: "calls",
          required: true,
          confidence: 1
        }
      ]
    };
    const invokeNode = vi.fn(async (node: { id: string }) => {
      if (node.id === "function:produce") {
        return {
          success: true,
          stdout: "",
          stderr: "",
          exitCode: 0,
          durationMs: 4,
          executedPath: "/tmp/produce",
          output: 42,
          error: undefined,
          methodName: undefined
        };
      }

      throw new Error(`Unexpected invocation for ${node.id}`);
    });

    vi.mocked(prepareRuntimeWorkspace).mockResolvedValueOnce({
      workspaceDir: "/tmp/codeflow-run-graph",
      compileResult: { success: true, diagnostics: "", issues: [] },
      invokeNode,
      cleanup: vi.fn(async () => undefined)
    });

    const result = await runBlueprint({
      graph,
      input: "{}",
      includeGeneratedTests: false
    });

    expect(result.success).toBe(false);
    expect(result.summary).toEqual({
      passed: 1,
      failed: 1,
      blocked: 1,
      skipped: 0,
      warning: 0
    });
    expect(invokeNode).toHaveBeenCalledTimes(1);
    expect(invokeNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "function:produce" }),
      {},
      []
    );

    const produceStep = result.steps.find((step) => step.nodeId === "function:produce" && step.kind === "node");
    const edgeStep = result.steps.find((step) => step.kind === "edge");
    const consumeStep = result.steps.find((step) => step.nodeId === "function:consume" && step.kind === "node");

    expect(produceStep?.status).toBe("passed");
    expect(edgeStep?.status).toBe("failed");
    expect(edgeStep?.message).toContain("Expected");
    expect(consumeStep?.status).toBe("blocked");
    expect(consumeStep?.blockedByStepId).toBe(edgeStep?.id);
    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts.some((artifact) => artifact.sourceNodeId === "function:produce" && artifact.actualType === "number")).toBe(true);
    expect(result.artifacts.some((artifact) => artifact.targetNodeId === "function:consume" && artifact.edgeId?.includes("function:produce:function:consume"))).toBe(true);
  });

  it("pins compile failures to the exact node file and blocks downstream nodes", async () => {
    const graph: MaterializedBlueprintGraph = createBaseGraph();

    vi.mocked(prepareRuntimeWorkspace).mockResolvedValueOnce({
      workspaceDir: "/tmp/codeflow-run-compile",
      compileResult: {
        success: false,
        diagnostics: "TypeScript failed.",
        issues: [
          {
            filePath: "/tmp/codeflow-run-compile/stubs/function-produce.ts",
            line: 3,
            column: 1,
            message: "Unexpected token."
          }
        ]
      },
      invokeNode: vi.fn(),
      cleanup: vi.fn(async () => undefined)
    });

    const result = await runBlueprint({
      graph,
      input: "{}",
      includeGeneratedTests: false
    });

    expect(result.success).toBe(false);
    expect(result.summary).toEqual({
      passed: 0,
      failed: 1,
      blocked: 1,
      skipped: 0,
      warning: 0
    });

    const produceStep = result.steps.find((step) => step.nodeId === "function:produce");
    const consumeStep = result.steps.find((step) => step.nodeId === "function:consume");

    expect(produceStep?.status).toBe("failed");
    expect(produceStep?.stderr).toContain("Unexpected token");
    expect(consumeStep?.status).toBe("blocked");
    expect(consumeStep?.stderr).toContain("TypeScript failed");
  });

  it("surfaces method-level failures for class nodes instead of hiding them behind the module", async () => {
    const graph: MaterializedBlueprintGraph = {
      projectName: "Class Runtime",
      mode: "essential",
      phase: "implementation",
      generatedAt: "2026-03-26T00:00:00.000Z",
      warnings: [],
      workflows: [],
      edges: [],
      nodes: [
        {
          id: "class:formatter",
          kind: "class",
          name: "Formatter",
          summary: "Format values.",
          contract: {
            ...emptyContract(),
            summary: "Format values.",
            methods: [
              {
                name: "format",
                summary: "Format the value.",
                inputs: [{ name: "input", type: "string" }],
                outputs: [{ name: "result", type: "string" }],
                sideEffects: [],
                calls: []
              }
            ]
          },
          status: "implemented",
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const invokeNode = vi.fn(async () => ({
      success: true,
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 6,
      executedPath: "/tmp/formatter",
      output: { result: 123 },
      error: undefined,
      methodName: "format"
    }));

    vi.mocked(prepareRuntimeWorkspace).mockResolvedValueOnce({
      workspaceDir: "/tmp/codeflow-run-class",
      compileResult: { success: true, diagnostics: "", issues: [] },
      invokeNode,
      cleanup: vi.fn(async () => undefined)
    });

    const result = await runBlueprint({
      graph: graph as MaterializedBlueprintGraph,
      input: '"hello"',
      targetNodeId: "class:formatter",
      includeGeneratedTests: false
    });

    expect(result.success).toBe(false);
    expect(invokeNode).toHaveBeenCalledTimes(1);
    expect(invokeNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: "class:formatter" }),
      "hello",
      ["hello"]
    );

    const methodStep = result.steps.find((step) => step.kind === "method");
    const classStep = result.steps.find((step) => step.kind === "node");

    expect(methodStep?.methodName).toBe("format");
    expect(methodStep?.status).toBe("failed");
    expect(methodStep?.outputPreview).toContain("123");
    expect(classStep?.status).toBe("failed");
    expect(classStep?.contractChecks.some((check) => check.stage === "output" && check.status === "failed")).toBe(true);
  });
});
