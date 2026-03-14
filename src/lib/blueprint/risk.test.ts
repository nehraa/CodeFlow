import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createRunPlan } from "@/lib/blueprint/plan";
import { assessExportRisk } from "@/lib/blueprint/risk";
import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

const createdDirs: string[] = [];

const createGraph = (mode: BlueprintGraph["mode"]): BlueprintGraph => ({
  projectName: "Risky Export",
  mode,
  generatedAt: "2026-03-14T00:00:00.000Z",
  warnings: [],
  workflows: [],
  edges: [],
  nodes: [
    {
      id: "function:write-report",
      kind: "function",
      name: "writeReport",
      summary: "Write a report.",
      contract: { ...emptyContract(), summary: "Write a report." },
      sourceRefs: [{ kind: "repo", path: "src/report.ts" }],
      generatedRefs: [],
      traceRefs: []
    }
  ]
});

afterEach(async () => {
  await Promise.all(createdDirs.map((directory) => fs.rm(directory, { recursive: true, force: true })));
  createdDirs.length = 0;
  delete process.env.CODEFLOW_WORKSPACE_ROOT;
});

describe("assessExportRisk", () => {
  it("requires approval in essential mode when overwriting an existing directory", async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-risk-"));
    const outputDir = path.join(workspaceRoot, "artifacts", "risky-export");
    createdDirs.push(workspaceRoot);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, "existing.txt"), "present", "utf8");
    process.env.CODEFLOW_WORKSPACE_ROOT = workspaceRoot;

    const graph = createGraph("essential");
    const plan = createRunPlan(graph);
    const assessment = await assessExportRisk(graph, plan, outputDir);

    expect(assessment.hasExistingOutput).toBe(true);
    expect(assessment.riskReport.requiresApproval).toBe(true);
    expect(assessment.riskReport.factors.some((factor) => factor.code === "overwrite-existing-output")).toBe(
      true
    );
  });

  it("never requires approval in yolo mode", async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-risk-yolo-"));
    createdDirs.push(workspaceRoot);
    process.env.CODEFLOW_WORKSPACE_ROOT = workspaceRoot;

    const graph = createGraph("yolo");
    const plan = createRunPlan(graph);
    const assessment = await assessExportRisk(graph, plan);

    expect(assessment.riskReport.requiresApproval).toBe(false);
    expect(assessment.riskReport.factors.some((factor) => factor.code === "yolo-mode")).toBe(true);
  });
});
