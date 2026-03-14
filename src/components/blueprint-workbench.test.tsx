import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BlueprintWorkbench } from "@/components/blueprint-workbench";

vi.mock("@/components/graph-canvas", () => ({
  GraphCanvas: ({
    graph,
    nodes,
    onSelect
    ,
    onNodeDoubleClick
  }: {
    graph: { nodes: Array<{ id: string; name: string }> } | null;
    nodes?: Array<{ id: string; data?: { label?: string } }>;
    onSelect: (nodeId: string) => void;
    onNodeDoubleClick?: (nodeId: string) => void;
  }) => (
    <div>
      {(nodes?.length
        ? nodes.map((node) => ({ id: node.id, name: node.data?.label ?? node.id }))
        : graph?.nodes.map((node) => ({ id: node.id, name: node.name })) ?? []
      ).map((node) => (
        <button
          key={node.id}
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => onNodeDoubleClick?.(node.id)}
          type="button"
        >
          {node.name}
        </button>
      ))}
      {!graph && !nodes?.length ? <p>No graph</p> : null}
    </div>
  )
}));

vi.mock("@/components/code-editor", () => ({
  CodeEditor: ({
    value,
    onChange,
    ariaLabel,
    readOnly
  }: {
    value: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label={ariaLabel ?? "Code editor"}
      onChange={(event) => onChange(event.target.value)}
      readOnly={readOnly}
      value={value}
    />
  )
}));

const fetchMock = vi.fn();

describe("BlueprintWorkbench", () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("builds a blueprint and allows node inspection", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/generate-blueprint" && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            serverApiKeyConfigured: false
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          graph: {
            projectName: "Workbench",
            mode: "essential",
            generatedAt: "2026-03-13T00:00:00.000Z",
            warnings: [],
            workflows: [],
            edges: [],
            nodes: [
              {
                id: "function:save-task",
                kind: "function",
                name: "saveTask",
                summary: "Save a task.",
                contract: {
                  summary: "Save a task.",
                  inputs: [],
                  outputs: [],
                  sideEffects: [],
                  errors: [],
                  dependencies: [],
                  uiAccess: [],
                  backendAccess: [],
                  notes: []
                },
                sourceRefs: [],
                generatedRefs: [],
                traceRefs: []
              }
            ]
          },
          runPlan: {
            generatedAt: "2026-03-13T00:00:00.000Z",
            tasks: [
              {
                id: "task:function:save-task",
                nodeId: "function:save-task",
                title: "function: saveTask",
                kind: "function",
                dependsOn: [],
                ownerPath: "stubs/function-save-task.ts",
                batchIndex: 0
              }
            ],
            batches: [{ index: 0, taskIds: ["task:function:save-task"] }],
            warnings: []
          },
          session: {
            sessionId: "session-1",
            projectName: "Workbench",
            updatedAt: "2026-03-13T00:00:00.000Z",
            graph: {
              projectName: "Workbench",
              mode: "essential",
              generatedAt: "2026-03-13T00:00:00.000Z",
              warnings: [],
              workflows: [],
              edges: [],
              nodes: []
            },
            runPlan: {
              generatedAt: "2026-03-13T00:00:00.000Z",
              tasks: [],
              batches: [],
              warnings: []
            },
            approvalIds: []
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BlueprintWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Workbench" }
    });
    // Switch to legacy PRD mode
    fireEvent.click(screen.getByLabelText("PRD / Repo (JS/TS)"));
    fireEvent.change(screen.getByLabelText("PRD markdown"), {
      target: { value: "# Functions\n- Function: saveTask()" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Build blueprint" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/blueprint",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    expect(await screen.findByRole("button", { name: "saveTask" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "saveTask" }));
    expect(screen.getByDisplayValue("Save a task.")).toBeInTheDocument();
    expect(screen.getByText(/1 tasks across 1 batches/)).toBeInTheDocument();
    expect((screen.getByLabelText("Code editor") as HTMLTextAreaElement).value).toContain("export function saveTask");
    expect(screen.getByLabelText("Live completions")).toBeChecked();
    expect(screen.getByText("Live completions are waiting for a browser or server NVIDIA API key.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Live completions"));
    expect(screen.getByText("Live completions are disabled for this browser.")).toBeInTheDocument();
  });

  it("shows API key status and build progress in AI mode", async () => {
    let resolveBuild:
      | ((value: {
          ok: boolean;
          json: () => Promise<{
            graph: {
              projectName: string;
              mode: string;
              generatedAt: string;
              warnings: string[];
              workflows: [];
              edges: [];
              nodes: Array<{
                id: string;
                kind: string;
                name: string;
                summary: string;
                contract: {
                  summary: string;
                  inputs: [];
                  outputs: [];
                  sideEffects: [];
                  errors: [];
                  dependencies: [];
                  uiAccess: [];
                  backendAccess: [];
                  notes: [];
                };
                sourceRefs: [];
                generatedRefs: [];
                traceRefs: [];
              }>;
            };
            runPlan: {
              generatedAt: string;
              tasks: [];
              batches: [];
              warnings: [];
            };
            session: {
              sessionId: string;
              projectName: string;
              updatedAt: string;
              graph: {
                projectName: string;
                mode: string;
                generatedAt: string;
                warnings: [];
                workflows: [];
                edges: [];
                nodes: [];
              };
              runPlan: {
                generatedAt: string;
                tasks: [];
                batches: [];
                warnings: [];
              };
              approvalIds: [];
            };
          }>;
        }) => void)
      | undefined;

    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((resolve) => {
          if (input === "/api/generate-blueprint" && (!init?.method || init.method === "GET")) {
            resolve({
              ok: true,
              json: async () => ({
                serverApiKeyConfigured: true
              })
            });
            return;
          }

          resolveBuild = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<BlueprintWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect((await screen.findAllByText(/Server environment key detected/)).length).toBeGreaterThan(0);

    fireEvent.change(
      screen.getByPlaceholderText(/A task management app with a React frontend and Node backend/),
      {
      target: { value: "A Go API with a React dashboard" }
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Build blueprint" }));

    expect(await screen.findByText("Building blueprint with NVIDIA")).toBeInTheDocument();
    expect(screen.getByText(/Waiting for the model response|Sending your prompt to NVIDIA/)).toBeInTheDocument();

    resolveBuild?.({
      ok: true,
      json: async () => ({
        graph: {
          projectName: "Workbench",
          mode: "essential",
          generatedAt: "2026-03-13T00:00:00.000Z",
          warnings: [],
          workflows: [],
          edges: [],
          nodes: [
            {
              id: "api:tasks",
              kind: "api",
              name: "POST /api/tasks",
              summary: "Create a task.",
              contract: {
                summary: "Create a task.",
                inputs: [],
                outputs: [],
                sideEffects: [],
                errors: [],
                dependencies: [],
                uiAccess: [],
                backendAccess: [],
                notes: []
              },
              sourceRefs: [],
              generatedRefs: [],
              traceRefs: []
            }
          ]
        },
        runPlan: {
          generatedAt: "2026-03-13T00:00:00.000Z",
          tasks: [],
          batches: [],
          warnings: []
        },
        session: {
          sessionId: "session-2",
          projectName: "Workbench",
          updatedAt: "2026-03-13T00:00:00.000Z",
          graph: {
            projectName: "Workbench",
            mode: "essential",
            generatedAt: "2026-03-13T00:00:00.000Z",
            warnings: [],
            workflows: [],
            edges: [],
            nodes: []
          },
          runPlan: {
            generatedAt: "2026-03-13T00:00:00.000Z",
            tasks: [],
            batches: [],
            warnings: []
          },
          approvalIds: []
        }
      })
    });

    expect(await screen.findByText("Blueprint ready")).toBeInTheDocument();
    expect(screen.getByText(/Built 1 nodes, 0 edges, and 0 workflows/)).toBeInTheDocument();
  });

  it("drills into a module graph and shows detailed function documentation", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/generate-blueprint" && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            serverApiKeyConfigured: false
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          graph: {
            projectName: "Workbench",
            mode: "essential",
            generatedAt: "2026-03-13T00:00:00.000Z",
            warnings: [],
            workflows: [],
            edges: [
              {
                from: "function:save-task",
                to: "function:normalize-task",
                kind: "calls",
                required: true,
                confidence: 1
              }
            ],
            nodes: [
              {
                id: "module:task-module",
                kind: "module",
                name: "Task Module",
                summary: "Owns task orchestration.",
                contract: {
                  summary: "Owns task orchestration.",
                  responsibilities: ["Coordinate task creation and persistence"],
                  inputs: [],
                  outputs: [],
                  attributes: [{ name: "taskStore", type: "TaskRepository" }],
                  methods: [],
                  sideEffects: [],
                  errors: ["Task validation failed"],
                  dependencies: ["TaskRepository"],
                  calls: [],
                  uiAccess: [],
                  backendAccess: [],
                  notes: ["Entry point for task work."]
                },
                sourceRefs: [],
                generatedRefs: [],
                traceRefs: []
              },
              {
                id: "function:save-task",
                kind: "function",
                name: "saveTask",
                ownerId: "module:task-module",
                summary: "Persist a task.",
                signature: "saveTask(input: TaskInput): Task",
                contract: {
                  summary: "Persist a task.",
                  responsibilities: ["Validate and save a task"],
                  inputs: [{ name: "input", type: "TaskInput" }],
                  outputs: [{ name: "result", type: "Task" }],
                  attributes: [],
                  methods: [],
                  sideEffects: ["Writes a task record"],
                  errors: ["Task repository failed"],
                  dependencies: ["TaskRepository", "normalizeTask"],
                  calls: [{ target: "normalizeTask", kind: "calls", description: "Normalizes the title" }],
                  uiAccess: [],
                  backendAccess: ["task_store"],
                  notes: ["Main persistence entry point."]
                },
                sourceRefs: [],
                generatedRefs: [],
                traceRefs: []
              },
              {
                id: "function:normalize-task",
                kind: "function",
                name: "normalizeTask",
                ownerId: "module:task-module",
                summary: "Normalize task data.",
                signature: "normalizeTask(input: TaskInput): TaskInput",
                contract: {
                  summary: "Normalize task data.",
                  responsibilities: ["Trim and normalize task fields"],
                  inputs: [{ name: "input", type: "TaskInput" }],
                  outputs: [{ name: "result", type: "TaskInput" }],
                  attributes: [],
                  methods: [],
                  sideEffects: [],
                  errors: [],
                  dependencies: [],
                  calls: [],
                  uiAccess: [],
                  backendAccess: [],
                  notes: []
                },
                sourceRefs: [],
                generatedRefs: [],
                traceRefs: []
              }
            ]
          },
          runPlan: {
            generatedAt: "2026-03-13T00:00:00.000Z",
            tasks: [],
            batches: [],
            warnings: []
          },
          session: {
            sessionId: "session-3",
            projectName: "Workbench",
            updatedAt: "2026-03-13T00:00:00.000Z",
            graph: {
              projectName: "Workbench",
              mode: "essential",
              generatedAt: "2026-03-13T00:00:00.000Z",
              warnings: [],
              workflows: [],
              edges: [],
              nodes: []
            },
            runPlan: {
              generatedAt: "2026-03-13T00:00:00.000Z",
              tasks: [],
              batches: [],
              warnings: []
            },
            approvalIds: []
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BlueprintWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByLabelText("PRD / Repo (JS/TS)"));
    fireEvent.change(screen.getByLabelText("PRD markdown"), {
      target: { value: "# Module\n- Module: Task Module" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Build blueprint" }));

    expect(await screen.findByRole("button", { name: "Task Module" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Task Module" }));
    expect(await screen.findByText("Responsibilities")).toBeInTheDocument();
    expect(screen.getByText("Coordinate task creation and persistence")).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole("button", { name: "Task Module" }));
    expect(await screen.findByRole("button", { name: "Back to parent graph" })).toBeInTheDocument();
    expect(screen.getByText("Task Module internals")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "saveTask" }));
    expect(screen.getByText("Validate and save a task")).toBeInTheDocument();
    expect(screen.getByText("input: TaskInput")).toBeInTheDocument();
    expect(screen.getAllByText("TaskRepository").length).toBeGreaterThan(0);
    expect(screen.getByText("normalizeTask [calls] - Normalizes the title")).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole("button", { name: "saveTask" }));
    expect(await screen.findByText("saveTask internals")).toBeInTheDocument();
    expect((screen.getByLabelText("Code editor") as HTMLTextAreaElement).value).toContain("export function saveTask");
  });

  it("hard-gates phases and enables implementation only after entering phase 2", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/generate-blueprint" && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            serverApiKeyConfigured: false
          })
        };
      }

      if (input === "/api/implement-node") {
        return {
          ok: true,
          json: async () => ({
            graph: {
              projectName: "Workbench",
              mode: "essential",
              phase: "implementation",
              generatedAt: "2026-03-13T00:00:00.000Z",
              warnings: [],
              workflows: [],
              edges: [],
              nodes: [
                {
                  id: "function:save-task",
                  kind: "function",
                  name: "saveTask",
                  summary: "Save a task.",
                  status: "implemented",
                  specDraft: "export function saveTask(input: string) { throw new Error('todo'); }",
                  implementationDraft: "export function saveTask(input: string) { return input.trim(); }",
                  contract: {
                    summary: "Save a task.",
                    responsibilities: [],
                    inputs: [{ name: "input", type: "string" }],
                    outputs: [],
                    attributes: [],
                    methods: [],
                    sideEffects: [],
                    errors: [],
                    dependencies: [],
                    calls: [],
                    uiAccess: [],
                    backendAccess: [],
                    notes: []
                  },
                  sourceRefs: [],
                  generatedRefs: [],
                  traceRefs: []
                }
              ]
            },
            runPlan: {
              generatedAt: "2026-03-13T00:00:00.000Z",
              tasks: [],
              batches: [],
              warnings: []
            },
            session: {
              sessionId: "session-4",
              projectName: "Workbench",
              updatedAt: "2026-03-13T00:00:00.000Z",
              graph: {
                projectName: "Workbench",
                mode: "essential",
                phase: "implementation",
                generatedAt: "2026-03-13T00:00:00.000Z",
                warnings: [],
                workflows: [],
                edges: [],
                nodes: []
              },
              runPlan: {
                generatedAt: "2026-03-13T00:00:00.000Z",
                tasks: [],
                batches: [],
                warnings: []
              },
              approvalIds: []
            },
            implementation: {
              summary: "Implemented saveTask",
              code: "export function saveTask(input: string) { return input.trim(); }",
              notes: []
            }
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          graph: {
            projectName: "Workbench",
            mode: "essential",
            phase: "spec",
            generatedAt: "2026-03-13T00:00:00.000Z",
            warnings: [],
            workflows: [],
            edges: [],
            nodes: [
              {
                id: "function:save-task",
                kind: "function",
                name: "saveTask",
                summary: "Save a task.",
                status: "spec_only",
                specDraft: "export function saveTask(input: string) { throw new Error('todo'); }",
                contract: {
                  summary: "Save a task.",
                  responsibilities: [],
                  inputs: [{ name: "input", type: "string" }],
                  outputs: [],
                  attributes: [],
                  methods: [],
                  sideEffects: [],
                  errors: [],
                  dependencies: [],
                  calls: [],
                  uiAccess: [],
                  backendAccess: [],
                  notes: []
                },
                sourceRefs: [],
                generatedRefs: [],
                traceRefs: []
              }
            ]
          },
          runPlan: {
            generatedAt: "2026-03-13T00:00:00.000Z",
            tasks: [],
            batches: [],
            warnings: []
          },
          session: {
            sessionId: "session-4",
            projectName: "Workbench",
            updatedAt: "2026-03-13T00:00:00.000Z",
            graph: {
              projectName: "Workbench",
              mode: "essential",
              phase: "spec",
              generatedAt: "2026-03-13T00:00:00.000Z",
              warnings: [],
              workflows: [],
              edges: [],
              nodes: []
            },
            runPlan: {
              generatedAt: "2026-03-13T00:00:00.000Z",
              tasks: [],
              batches: [],
              warnings: []
            },
            approvalIds: []
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BlueprintWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByLabelText("PRD / Repo (JS/TS)"));
    fireEvent.change(screen.getByLabelText("PRD markdown"), {
      target: { value: "# Functions\n- Function: saveTask()" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Build blueprint" }));

    expect(await screen.findByText("Current phase: spec")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "saveTask" }));
    expect(screen.getByRole("button", { name: "Implement node" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Enter Phase 2" }));
    expect(screen.getByText("Phase 2 unlocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Implement node" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Implement node" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/implement-node",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("runs architecture analysis and shows the analysis panel with metrics, smells, cycles, and mermaid output", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (input === "/api/generate-blueprint" && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({ serverApiKeyConfigured: false })
        };
      }

      if (input === "/api/analysis/cycles") {
        return {
          ok: true,
          json: async () => ({
            report: {
              analyzedAt: "2026-03-14T00:00:00.000Z",
              totalCycles: 0,
              maxCycleLength: 0,
              cycles: [],
              affectedNodeIds: []
            }
          })
        };
      }

      if (input === "/api/analysis/smells") {
        return {
          ok: true,
          json: async () => ({
            report: {
              analyzedAt: "2026-03-14T00:00:00.000Z",
              totalSmells: 1,
              healthScore: 85,
              smells: [
                {
                  code: "orphan-node",
                  severity: "info",
                  nodeId: "function:save-task",
                  message: "Node \"saveTask\" has no connections.",
                  suggestion: "Connect this node or remove it."
                }
              ]
            }
          })
        };
      }

      if (input === "/api/analysis/metrics") {
        return {
          ok: true,
          json: async () => ({
            metrics: {
              analyzedAt: "2026-03-14T00:00:00.000Z",
              nodeCount: 1,
              edgeCount: 0,
              nodesByKind: { function: 1 },
              edgesByKind: {},
              nodesByStatus: { spec_only: 1 },
              density: 0,
              avgDegree: 0,
              maxInDegree: 0,
              maxOutDegree: 0,
              maxInDegreeNodeId: undefined,
              maxOutDegreeNodeId: undefined,
              avgMethodsPerNode: 0,
              avgResponsibilitiesPerNode: 0,
              totalMethods: 0,
              totalResponsibilities: 0,
              connectedComponents: 0,
              isolatedNodes: 1,
              leafNodes: 0
            }
          })
        };
      }

      if (input === "/api/export/mermaid") {
        return {
          ok: true,
          json: async () => ({
            diagram: "graph TD\n  function_save_task([saveTask])\n",
            format: "flowchart"
          })
        };
      }

      // Default: blueprint build response
      return {
        ok: true,
        json: async () => ({
          graph: {
            projectName: "Analysis Test",
            mode: "essential",
            generatedAt: "2026-03-14T00:00:00.000Z",
            warnings: [],
            workflows: [],
            edges: [],
            nodes: [
              {
                id: "function:save-task",
                kind: "function",
                name: "saveTask",
                summary: "Save a task.",
                contract: {
                  summary: "Save a task.",
                  inputs: [],
                  outputs: [],
                  sideEffects: [],
                  errors: [],
                  dependencies: [],
                  uiAccess: [],
                  backendAccess: [],
                  notes: []
                },
                sourceRefs: [],
                generatedRefs: [],
                traceRefs: []
              }
            ]
          },
          runPlan: {
            generatedAt: "2026-03-14T00:00:00.000Z",
            tasks: [],
            batches: [],
            warnings: []
          },
          session: {
            sessionId: "session-analysis",
            projectName: "Analysis Test",
            updatedAt: "2026-03-14T00:00:00.000Z",
            graph: {
              projectName: "Analysis Test",
              mode: "essential",
              generatedAt: "2026-03-14T00:00:00.000Z",
              warnings: [],
              workflows: [],
              edges: [],
              nodes: []
            },
            runPlan: {
              generatedAt: "2026-03-14T00:00:00.000Z",
              tasks: [],
              batches: [],
              warnings: []
            },
            approvalIds: []
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BlueprintWorkbench />);

    // Build the blueprint first (using legacy mode for determinism)
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByLabelText("PRD / Repo (JS/TS)"));
    fireEvent.change(screen.getByLabelText("PRD markdown"), {
      target: { value: "# Functions\n- Function: saveTask()" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Build blueprint" }));

    // Wait for the graph to be built
    expect(await screen.findByRole("button", { name: "saveTask" })).toBeInTheDocument();

    // Click the Analyze button
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    // Verify all 4 analysis endpoints were called
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analysis/cycles",
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analysis/smells",
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analysis/metrics",
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/export/mermaid",
        expect.objectContaining({ method: "POST" })
      );
    });

    // Analysis panel should appear and render each section
    expect(await screen.findByText("Architecture Analysis")).toBeInTheDocument();
    expect(await screen.findByText("Graph Metrics")).toBeInTheDocument();
    expect(await screen.findByText(/Nodes: 1/)).toBeInTheDocument();
    expect(await screen.findByText("Architecture Health: 85/100")).toBeInTheDocument();
    expect(await screen.findByText(/1 smell detected/)).toBeInTheDocument();
    expect(await screen.findByText(/orphan-node/)).toBeInTheDocument();
    expect(await screen.findByText("Dependency Cycles")).toBeInTheDocument();
    expect(await screen.findByText("No dependency cycles found. Graph is a clean DAG!")).toBeInTheDocument();
    expect(await screen.findByText("Mermaid Diagram")).toBeInTheDocument();
    expect(await screen.findByText(/graph TD/)).toBeInTheDocument();

    // The status callout should show analysis summary
    expect(await screen.findByText("Analysis complete")).toBeInTheDocument();
    expect(await screen.findByText(/1 smells.*0 cycles.*Health 85\/100/)).toBeInTheDocument();
  });

  it("shows the Branches panel and can create a branch after building", async () => {
    const createdBranch = {
      id: "branch-1",
      name: "what-if-mongo",
      description: "Replace PostgreSQL with MongoDB",
      projectName: "Workbench",
      createdAt: "2026-03-14T00:00:00.000Z",
      graph: {
        projectName: "Workbench",
        mode: "essential",
        phase: "spec",
        generatedAt: "2026-03-13T00:00:00.000Z",
        warnings: [],
        workflows: [],
        edges: [],
        nodes: [
          {
            id: "function:save-task",
            kind: "function",
            name: "saveTask",
            summary: "Save a task.",
            contract: {
              summary: "Save a task.",
              responsibilities: [],
              inputs: [],
              outputs: [],
              attributes: [],
              methods: [],
              sideEffects: [],
              errors: [],
              dependencies: [],
              calls: [],
              uiAccess: [],
              backendAccess: [],
              notes: []
            },
            sourceRefs: [],
            generatedRefs: [],
            traceRefs: []
          }
        ]
      }
    };

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/generate-blueprint" && (!init?.method || init.method === "GET")) {
        return { ok: true, json: async () => ({ serverApiKeyConfigured: false }) };
      }

      if (url.startsWith("/api/branches") && (!init?.method || init.method === "GET")) {
        return { ok: true, json: async () => ({ branches: [] }) };
      }

      if (url === "/api/branches" && init?.method === "POST") {
        return { ok: true, json: async () => ({ branch: createdBranch }) };
      }

      return {
        ok: true,
        json: async () => ({
          graph: {
            projectName: "Workbench",
            mode: "essential",
            generatedAt: "2026-03-13T00:00:00.000Z",
            warnings: [],
            workflows: [],
            edges: [],
            nodes: [
              {
                id: "function:save-task",
                kind: "function",
                name: "saveTask",
                summary: "Save a task.",
                contract: {
                  summary: "Save a task.",
                  inputs: [],
                  outputs: [],
                  sideEffects: [],
                  errors: [],
                  dependencies: [],
                  uiAccess: [],
                  backendAccess: [],
                  notes: []
                },
                sourceRefs: [],
                generatedRefs: [],
                traceRefs: []
              }
            ]
          },
          runPlan: {
            generatedAt: "2026-03-13T00:00:00.000Z",
            tasks: [],
            batches: [],
            warnings: []
          },
          session: {
            sessionId: "session-branch",
            projectName: "Workbench",
            updatedAt: "2026-03-13T00:00:00.000Z",
            graph: {
              projectName: "Workbench",
              mode: "essential",
              generatedAt: "2026-03-13T00:00:00.000Z",
              warnings: [],
              workflows: [],
              edges: [],
              nodes: []
            },
            runPlan: {
              generatedAt: "2026-03-13T00:00:00.000Z",
              tasks: [],
              batches: [],
              warnings: []
            },
            approvalIds: []
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BlueprintWorkbench />);

    // Open settings and switch to legacy PRD mode
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Workbench" }
    });
    fireEvent.click(screen.getByLabelText("PRD / Repo (JS/TS)"));
    fireEvent.change(screen.getByLabelText("PRD markdown"), {
      target: { value: "# Functions\n- Function: saveTask()" }
    });

    // Build a blueprint first
    fireEvent.click(screen.getByRole("button", { name: "Build blueprint" }));
    await screen.findByRole("button", { name: "saveTask" });

    // The "Branches" button should now appear in the topbar
    const branchesButton = await screen.findByRole("button", { name: /Branches/ });
    expect(branchesButton).toBeInTheDocument();

    // Open the branch panel
    fireEvent.click(branchesButton);
    expect(await screen.findByText("Time-Travel Branches")).toBeInTheDocument();
    expect(await screen.findByText("Create a new branch")).toBeInTheDocument();

    // Type a branch name and create it
    fireEvent.change(screen.getByPlaceholderText("e.g. swap-postgres-for-mongo"), {
      target: { value: "what-if-mongo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save as branch" }));

    // After creation the branch should appear in the list and status should update
    expect(await screen.findByText("Branch created")).toBeInTheDocument();
    expect(await screen.findByText(/what-if-mongo.*branch saved as a snapshot/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Switch to this branch/ })).toBeInTheDocument();
  });
});
