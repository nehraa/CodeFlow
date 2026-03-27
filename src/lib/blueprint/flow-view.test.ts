import { describe, expect, it } from "vitest";

import { buildDetailFlow, buildFlowEdges, buildFlowNodes, buildGhostFlowNodes } from "@/lib/blueprint/flow-view";
import type { BlueprintGraph, GhostNode, RuntimeExecutionResult } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const graph: BlueprintGraph = {
  projectName: "Flow View",
  mode: "essential",
  generatedAt: "2026-03-13T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [
    {
      from: "ui-screen:home",
      to: "api:post-tasks",
      kind: "calls",
      required: true,
      confidence: 1
    }
  ],
  nodes: [
    {
      id: "ui-screen:home",
      kind: "ui-screen",
      name: "Home Screen",
      summary: "Main screen.",
      contract: {
        ...emptyContract(),
        summary: "Main screen."
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "api:post-tasks",
      kind: "api",
      name: "POST /api/tasks",
      summary: "Create a task.",
      contract: {
        ...emptyContract(),
        summary: "Create a task."
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: [],
      traceState: {
        status: "success",
        count: 1,
        errors: 0,
        totalDurationMs: 10,
        lastSpanIds: ["span-1"]
      }
    }
  ]
};

describe("flow-view", () => {
  it("builds flow nodes with kind-based layout and trace-aware styling", () => {
    const nodes = buildFlowNodes(graph, "api:post-tasks", undefined, ["api:post-tasks"]);

    expect(nodes).toHaveLength(2);
    expect(nodes[0].position.x).toBeLessThan(nodes[1].position.x);
    expect(String(nodes[1].style?.background)).toContain("linear-gradient");
    expect(String(nodes[1].style?.boxShadow)).toContain("rgba");
    expect(nodes[1].data.healthState).toBe("neutral");
    expect(nodes[1].data.isActiveBatch).toBe(true);
  });

  it("builds flow edges from blueprint edges", () => {
    const edges = buildFlowEdges(graph, ["api:post-tasks"]);

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("ui-screen:home");
    expect(edges[0].target).toBe("api:post-tasks");
    expect(edges[0].className).toBe("edge-flow-active");
  });

  it("overlays runtime execution states on nodes and edges", () => {
    const runtimeGraph: BlueprintGraph = {
      ...graph,
      edges: [
        ...graph.edges,
        {
          from: "module:tasks",
          to: "function:save-task",
          kind: "calls",
          required: true,
          confidence: 1,
          label: "calls"
        }
      ],
      nodes: [
        {
          id: "module:tasks",
          kind: "module",
          name: "Task Module",
          summary: "Owns tasks.",
          contract: { ...emptyContract(), summary: "Owns tasks." },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        },
        {
          id: "function:save-task",
          kind: "function",
          name: "saveTask",
          ownerId: "module:tasks",
          summary: "Save a task.",
          contract: {
            ...emptyContract(),
            summary: "Save a task.",
            outputs: [{ name: "result", type: "Task" }]
          },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        },
        {
          id: "api:post-tasks",
          kind: "api",
          name: "POST /api/tasks",
          summary: "Create a task.",
          contract: {
            ...emptyContract(),
            summary: "Create a task."
          },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ]
    };

    const executionResult: RuntimeExecutionResult = {
      success: false,
      stdout: "",
      stderr: "",
      exitCode: 1,
      durationMs: 34,
      runId: "run-1",
      entryNodeId: "function:save-task",
      steps: [
        {
          id: "step-method-save-task",
          runId: "run-1",
          kind: "method",
          nodeId: "function:save-task",
          parentNodeId: "module:tasks",
          methodName: "saveTask",
          status: "failed",
          startedAt: "2026-03-13T10:00:00.000Z",
          completedAt: "2026-03-13T10:00:01.000Z",
          durationMs: 1000,
          stdout: "",
          stderr: "assertion failed",
          message: "Contract validation failed.",
          artifactIds: [],
          contractChecks: [
            {
              stage: "input",
              status: "passed",
              expected: "input: TaskInput",
              actualPreview: "{\"title\":\"hello\"}",
              message: "Input validated."
            }
          ]
        },
        {
          id: "step-edge-save-task",
          runId: "run-1",
          kind: "edge",
          nodeId: "function:save-task",
          edgeId: "calls:module:tasks:function:save-task",
          status: "blocked",
          startedAt: "2026-03-13T10:00:01.000Z",
          completedAt: "2026-03-13T10:00:01.050Z",
          durationMs: 50,
          stdout: "",
          stderr: "",
          message: "Downstream blocked by failure.",
          artifactIds: [],
          contractChecks: []
        }
      ],
      artifacts: [],
      summary: { passed: 0, failed: 1, blocked: 1, skipped: 0, warning: 0 },
      testCases: [],
      testResults: []
    };

    const nodes = buildFlowNodes(runtimeGraph, undefined, undefined, undefined, undefined, executionResult);
    const edges = buildFlowEdges(runtimeGraph, undefined, executionResult);

    expect(nodes.find((node) => node.id === "function:save-task")?.data.execution?.status).toBe("failed");
    expect(nodes.find((node) => node.id === "module:tasks")?.data.execution?.status).toBe("failed");
    expect(edges.find((edge) => edge.id === "calls:module:tasks:function:save-task")?.className).toContain("edge-flow-blocked");
  });

  it("builds a drill-down graph for a selected node", () => {
    const detailedGraph: BlueprintGraph = {
      ...graph,
      nodes: [
        {
          id: "module:tasks",
          kind: "module",
          name: "Task Module",
          summary: "Owns tasks.",
          contract: {
            ...emptyContract(),
            summary: "Owns tasks.",
            responsibilities: ["Coordinate task persistence"],
            attributes: [{ name: "taskStore", type: "TaskRepository" }]
          },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        },
        {
          id: "function:save-task",
          kind: "function",
          name: "saveTask",
          ownerId: "module:tasks",
          summary: "Save a task.",
          contract: {
            ...emptyContract(),
            summary: "Save a task.",
            responsibilities: ["Persist a task"],
            inputs: [{ name: "input", type: "TaskInput" }],
            outputs: [{ name: "result", type: "Task" }]
          },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ],
      edges: []
    };

    const detail = buildDetailFlow(detailedGraph, "module:tasks");

    expect(detail).not.toBeNull();
    expect(detail?.items.some((item) => item.label === "Task Module")).toBe(true);
    expect(detail?.items.some((item) => item.label === "saveTask")).toBe(true);
    expect(detail?.items.some((item) => item.label === "taskStore: TaskRepository")).toBe(true);
  });

  it("attaches execution details to drill-down items when runtime data exists", () => {
    const detailedGraph: BlueprintGraph = {
      ...graph,
      nodes: [
        {
          id: "module:tasks",
          kind: "module",
          name: "Task Module",
          summary: "Owns tasks.",
          contract: {
            ...emptyContract(),
            summary: "Owns tasks.",
            responsibilities: ["Coordinate task persistence"]
          },
          sourceRefs: [],
          generatedRefs: [],
          traceRefs: []
        }
      ],
      edges: []
    };

    const executionResult: RuntimeExecutionResult = {
      success: true,
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 12,
      runId: "run-2",
      entryNodeId: "module:tasks",
      steps: [
        {
          id: "step-module",
          runId: "run-2",
          kind: "node",
          nodeId: "module:tasks",
          status: "passed",
          startedAt: "2026-03-13T10:00:00.000Z",
          completedAt: "2026-03-13T10:00:00.500Z",
          durationMs: 500,
          stdout: "ok",
          stderr: "",
          message: "Module verified.",
          artifactIds: [],
          contractChecks: []
        }
      ],
      artifacts: [],
      summary: { passed: 1, failed: 0, blocked: 0, skipped: 0, warning: 0 },
      testCases: [],
      testResults: []
    };

    const detail = buildDetailFlow(detailedGraph, "module:tasks", undefined, executionResult);

    expect(detail).not.toBeNull();
    const rootItem = detail?.items.find((item) => item.kind === "root");
    expect(rootItem?.execution?.status).toBe("passed");
    expect(rootItem?.sections.some((section) => section.title === "Execution")).toBe(true);
    expect(rootItem?.sections.flatMap((section) => section.items).join("\n")).toContain("Module verified.");
  });
});

describe("buildGhostFlowNodes", () => {
  const existingFlowNodes = buildFlowNodes(graph);

  const ghosts: GhostNode[] = [
    {
      id: "ghost:auth-middleware",
      kind: "module",
      name: "Auth Middleware",
      summary: "Authentication middleware.",
      reason: "APIs need auth.",
      suggestedEdge: { from: "api:post-tasks", to: "ghost:auth-middleware", kind: "calls" }
    },
    {
      id: "ghost:error-handler",
      kind: "module",
      name: "Error Handler",
      summary: "Centralised error handling.",
      reason: "Error handling is essential.",
      suggestedEdge: undefined
    }
  ];

  it("builds ghost flow nodes with ghost data flag set", () => {
    const ghostFlowNodes = buildGhostFlowNodes(ghosts, existingFlowNodes);

    expect(ghostFlowNodes).toHaveLength(2);
    expect(ghostFlowNodes[0].data.ghost).toBe(true);
    expect(ghostFlowNodes[0].data.ghostReason).toBe("APIs need auth.");
    expect(ghostFlowNodes[0].id).toBe("ghost:auth-middleware");
    expect(ghostFlowNodes[0].data.label).toBe("Auth Middleware");
  });

  it("positions ghost nodes to the right of existing nodes", () => {
    const ghostFlowNodes = buildGhostFlowNodes(ghosts, existingFlowNodes);
    const maxExistingX = Math.max(...existingFlowNodes.map((n) => n.position.x));

    for (const ghostNode of ghostFlowNodes) {
      expect(ghostNode.position.x).toBeGreaterThan(maxExistingX);
    }
  });

  it("renders ghost nodes with semi-transparent styling", () => {
    const ghostFlowNodes = buildGhostFlowNodes(ghosts, existingFlowNodes);

    expect(ghostFlowNodes[0].style?.opacity).toBeLessThan(1);
    expect(String(ghostFlowNodes[0].style?.border)).toContain("dashed");
  });

  it("returns empty array when given no ghost nodes", () => {
    const ghostFlowNodes = buildGhostFlowNodes([], existingFlowNodes);

    expect(ghostFlowNodes).toHaveLength(0);
  });
});
