import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { BlueprintGraph, RiskFactor, RiskReport, RunPlan } from "@abhinav2203/codeflow-core/schema";

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";

export type ExportRiskAssessment = {
  fingerprint: string;
  outputDir: string;
  riskReport: RiskReport;
  hasExistingOutput: boolean;
};

const scoreToLevel = (score: number): RiskReport["level"] => {
  if (score >= 6) {
    return "high";
  }

  if (score >= 3) {
    return "medium";
  }

  return "low";
};

const createFingerprint = (graph: BlueprintGraph, runPlan: RunPlan, outputDir: string): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        projectName: graph.projectName,
        mode: graph.mode,
        outputDir,
        nodes: graph.nodes.map((node) => node.id).sort(),
        edges: graph.edges.map((edge) => `${edge.kind}:${edge.from}:${edge.to}`).sort(),
        tasks: runPlan.tasks.map((task) => `${task.id}:${task.batchIndex}`).sort()
      })
    )
    .digest("hex");

const resolveWorkspaceRoot = (): string => {
  const configuredRoot = process.env.CODEFLOW_WORKSPACE_ROOT?.trim();
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  return path.join(process.cwd(), "artifacts");
};

const resolveDefaultOutputDir = (graph: BlueprintGraph): string => {
  const workspaceRoot = resolveWorkspaceRoot();
  if (process.env.CODEFLOW_WORKSPACE_ROOT?.trim()) {
    return path.resolve(workspaceRoot, "artifacts", slugify(graph.projectName));
  }

  return path.resolve(workspaceRoot, slugify(graph.projectName));
};

const resolveOutputDir = (graph: BlueprintGraph, outputDir?: string): string =>
  outputDir && outputDir.trim()
    ? path.resolve(outputDir)
    : resolveDefaultOutputDir(graph);

export const assessExportRisk = async (
  graph: BlueprintGraph,
  runPlan: RunPlan,
  outputDir?: string
): Promise<ExportRiskAssessment> => {
  const resolvedOutputDir = resolveOutputDir(graph, outputDir);
  const factors: RiskFactor[] = [];
  const repoBackedNodeCount = graph.nodes.filter((node) =>
    node.sourceRefs.some((ref) => ref.kind === "repo")
  ).length;
  const exists = await fs
    .stat(resolvedOutputDir)
    .then((stats) => stats.isDirectory())
    .catch(() => false);
  const existingEntries = exists ? (await fs.readdir(resolvedOutputDir)).filter(Boolean) : [];
  const hasExistingOutput = existingEntries.length > 0;
  const workspaceRoot = resolveWorkspaceRoot();
  const defaultOutputDir = resolveDefaultOutputDir(graph);

  if (hasExistingOutput) {
    factors.push({
      code: "overwrite-existing-output",
      message: `Output directory ${resolvedOutputDir} already contains files.`,
      score: 4
    });
  }

  if (outputDir && path.resolve(outputDir) !== defaultOutputDir) {
    factors.push({
      code: "custom-output-dir",
      message: `Artifacts will be written to a custom directory: ${resolvedOutputDir}.`,
      score: 1
    });
  }

  if (!resolvedOutputDir.startsWith(workspaceRoot)) {
    factors.push({
      code: "outside-workspace",
      message: `Output directory is outside the workspace root: ${resolvedOutputDir}.`,
      score: 2
    });
  }

  if (repoBackedNodeCount > 0) {
    factors.push({
      code: "repo-backed-context",
      message: `${repoBackedNodeCount} blueprint nodes were derived from a real repo.`,
      score: 1
    });
  }

  if (runPlan.tasks.length >= 20) {
    factors.push({
      code: "large-task-set",
      message: `Execution plan contains ${runPlan.tasks.length} tasks.`,
      score: 2
    });
  }

  if (runPlan.batches.length >= 6) {
    factors.push({
      code: "deep-execution-plan",
      message: `Execution plan spans ${runPlan.batches.length} batches.`,
      score: 1
    });
  }

  if (graph.mode === "yolo") {
    factors.push({
      code: "yolo-mode",
      message: "Yolo mode bypasses approval gates.",
      score: 2
    });
  }

  const score = factors.reduce((total, factor) => total + factor.score, 0);
  const riskReport: RiskReport = {
    score,
    level: scoreToLevel(score),
    requiresApproval: graph.mode === "essential" && (hasExistingOutput || score >= 4),
    factors
  };

  return {
    fingerprint: createFingerprint(graph, runPlan, resolvedOutputDir),
    outputDir: resolvedOutputDir,
    riskReport,
    hasExistingOutput
  };
};
