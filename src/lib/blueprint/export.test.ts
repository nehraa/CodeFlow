import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createExecutionReport } from "@/lib/blueprint/execute";
import { exportBlueprintArtifacts } from "@/lib/blueprint/export";
import { createRunPlan } from "@/lib/blueprint/plan";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const createdDirs: string[] = [];

const createGraph = (): BlueprintGraph => ({
  projectName: "Exporter",
  mode: "essential",
  generatedAt: "2026-03-13T00:00:00.000Z",
  workflows: [],
  warnings: [],
  edges: [],
  nodes: [
    {
      id: "ui-screen:workspace",
      kind: "ui-screen",
      name: "Workspace",
      summary: "Main workspace screen.",
      contract: {
        ...emptyContract(),
        summary: "Main workspace screen.",
        responsibilities: ["Render the workspace"],
        attributes: [{ name: "selectedNodeId", type: "string | null", description: "Currently selected node" }]
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    },
    {
      id: "function:save-task",
      kind: "function",
      name: "saveTask(task: TaskInput): Promise<Task>",
      summary: "Save a task.",
      signature: "saveTask(task: TaskInput): Promise<Task>",
      contract: {
        ...emptyContract(),
        summary: "Save a task.",
        responsibilities: ["Validate and persist a task"],
        inputs: [{ name: "task", type: "TaskInput" }],
        outputs: [{ name: "result", type: "Promise<Task>" }],
        methods: [
          {
            name: "saveTask",
            signature: "saveTask(task: TaskInput): Promise<Task>",
            summary: "Save the task",
            inputs: [{ name: "task", type: "TaskInput" }],
            outputs: [{ name: "result", type: "Promise<Task>" }],
            sideEffects: ["Writes a task record"],
            calls: [{ target: "TaskRepository", kind: "calls", description: "Persists the task" }]
          }
        ],
        calls: [{ target: "TaskRepository", kind: "calls", description: "Persists the task" }],
        sideEffects: ["Writes a task record"],
        dependencies: ["TaskRepository"]
      },
      sourceRefs: [],
      generatedRefs: [],
      traceRefs: []
    }
  ]
});

afterEach(async () => {
  await Promise.all(
    createdDirs.map(async (directory) => {
      await fs.rm(directory, { recursive: true, force: true });
    })
  );
  createdDirs.length = 0;
});

describe("exportBlueprintArtifacts", () => {
  it("writes blueprint json, docs, canvas, and stubs to disk", async () => {
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-export-"));
    createdDirs.push(targetDir);

    const graph = createGraph();
    const result = await exportBlueprintArtifacts(graph, targetDir, createExecutionReport(graph, createRunPlan(graph)));

    const blueprintFile = await fs.readFile(result.blueprintPath, "utf8");
    const indexDoc = await fs.readFile(path.join(result.docsDir, "index.md"), "utf8");
    const docFile = await fs.readFile(path.join(result.docsDir, "ui-screen-workspace.md"), "utf8");
    const stubEntries = await fs.readdir(result.stubsDir);
    const functionStub = stubEntries.find((entry) => entry.startsWith("function-"));
    expect(functionStub).toBeDefined();
    const stubFile = await fs.readFile(path.join(result.stubsDir, functionStub ?? ""), "utf8");
    const ownershipFile = await fs.readFile(result.ownershipPath ?? "", "utf8");
    const obsidianIndex = await fs.readFile(result.obsidianIndexPath ?? "", "utf8");

    expect(blueprintFile).toContain("\"projectName\": \"Exporter\"");
    expect(docFile).toContain("# Workspace");
    expect(docFile).toContain("Attributes / State:");
    expect(indexDoc).toContain("Execution phases:");
    expect(stubFile).toContain("export function saveTask");
    expect(ownershipFile).toContain("\"nodeId\": \"function:save-task\"");
    expect(obsidianIndex).toContain("[[docs/ui-screen-workspace]]");
    expect(obsidianIndex).toContain("[[system.canvas]]");
  });

  it("prefers edited code drafts over regenerated stub content when provided", async () => {
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-export-draft-"));
    createdDirs.push(targetDir);

    const graph = createGraph();
    const result = await exportBlueprintArtifacts(
      graph,
      targetDir,
      createExecutionReport(graph, createRunPlan(graph)),
      {
        "function:save-task": "export function saveTask(): string {\n  return \"edited draft\";\n}\n"
      }
    );

    const stubEntries = await fs.readdir(result.stubsDir);
    const functionStub = stubEntries.find((entry) => entry.startsWith("function-"));
    expect(functionStub).toBeDefined();

    const stubFile = await fs.readFile(path.join(result.stubsDir, functionStub ?? ""), "utf8");
    expect(stubFile).toContain("return \"edited draft\"");
  });
});
