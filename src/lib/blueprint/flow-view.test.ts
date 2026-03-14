import { describe, expect, it } from "vitest";

import { buildDetailFlow, buildFlowEdges, buildFlowNodes, buildGhostFlowNodes } from "@/lib/blueprint/flow-view";
import type { BlueprintGraph, GhostNode } from "@/lib/blueprint/schema";
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
    const nodes = buildFlowNodes(graph, "api:post-tasks");

    expect(nodes).toHaveLength(2);
    expect(nodes[0].position.x).toBeLessThan(nodes[1].position.x);
    expect(String(nodes[1].style?.background)).toContain("linear-gradient");
    expect(String(nodes[1].style?.boxShadow)).toContain("rgba");
  });

  it("builds flow edges from blueprint edges", () => {
    const edges = buildFlowEdges(graph);

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("ui-screen:home");
    expect(edges[0].target).toBe("api:post-tasks");
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
