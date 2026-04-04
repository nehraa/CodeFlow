import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeTypeScriptRepo } from "@/lib/blueprint/repo";

const fixturePath = path.resolve(process.cwd(), "src/lib/blueprint/test-fixtures/sample-repo");

describe("analyzeTypeScriptRepo", () => {
  it("extracts modules, classes, functions, screens, apis, and structural edges", async () => {
    const result = await analyzeTypeScriptRepo(fixturePath);
    const taskServiceClass = result.nodes.find((node) => node.kind === "class" && node.name === "TaskService");
    const saveTaskFunction = result.nodes.find((node) => node.kind === "function" && node.name === "TaskService.saveTask");

    expect(result.nodes.some((node) => node.kind === "module" && node.name === "src/services/task-service.ts")).toBe(
      true
    );
    expect(result.nodes.some((node) => node.kind === "class" && node.name === "TaskService")).toBe(true);
    expect(result.nodes.some((node) => node.kind === "function" && node.name === "TaskService.saveTask")).toBe(
      true
    );
    expect(result.nodes.some((node) => node.kind === "api" && node.name === "POST /api/tasks")).toBe(true);
    expect(result.nodes.some((node) => node.kind === "ui-screen" && node.name === "Home Screen")).toBe(true);
    expect(result.edges.some((edge) => edge.kind === "imports")).toBe(true);
    expect(result.edges.some((edge) => edge.kind === "inherits")).toBe(true);
    expect(result.edges.some((edge) => edge.kind === "calls")).toBe(true);
    expect(taskServiceClass?.contract.methods.some((method) => method.name === "saveTask")).toBe(true);
    expect(saveTaskFunction?.contract.calls.some((call) => call.target === "normalizeTask")).toBe(true);
    expect(saveTaskFunction?.contract.dependencies).toContain("normalizeTask");
    expect(taskServiceClass?.sourceLocation).toMatchObject({
      filePath: "src/services/task-service.ts",
      startLine: 13,
      endLine: 22,
      symbolName: "TaskService"
    });
    expect(saveTaskFunction?.sourceLocation).toMatchObject({
      filePath: "src/services/task-service.ts",
      startLine: 14,
      endLine: 21,
      symbolName: "TaskService.saveTask"
    });
  });
});
