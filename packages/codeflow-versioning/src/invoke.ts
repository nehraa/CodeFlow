import { z } from "zod";
import { createBranchId, createBranch as createBranchGraph, diffBranches } from "./branch/index";
import { saveBranch, loadBranch, loadBranches, deleteBranch } from "./store/index";
import {
  blueprintGraphSchema,
  type BlueprintGraph,
  type GraphBranch,
  type RunPlan
} from "@abhinav2203/codeflow-core/schema";
import { attachObservabilitySnapshot } from "./observability.js";
import { attachRiskReport } from "./risk.js";
import { attachSessionSnapshot } from "./session.js";

// Use z.custom() to bypass the ZodType compatibility issue with blueprintGraphSchema
const createBranchRequestSchema = z.object({
  graph: z.custom<BlueprintGraph>((val) => {
    try {
      blueprintGraphSchema.parse(val);
      return true;
    } catch {
      return false;
    }
  }),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  parentBranchId: z.string().optional(),
  runId: z.string().optional(),
  attachObservability: z.boolean().optional(),
  attachRisk: z.boolean().optional(),
  attachSession: z.boolean().optional(),
  runPlan: z.custom<RunPlan>((val) => {
    if (val == null) return true; // optional
    return typeof val === "object" && typeof (val as RunPlan).tasks !== "undefined" && Array.isArray((val as RunPlan).tasks);
  }).optional(),
  outputDir: z.string().optional()
});

export const listBranches = async (projectName: string): Promise<GraphBranch[]> => {
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`listBranches: projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  return loadBranches(projectName);
};

export const createBranch = async (payload: {
  graph: BlueprintGraph;
  name: string;
  description?: string;
  parentBranchId?: string;
  runId?: string;
  attachObservability?: boolean;
  attachRisk?: boolean;
  attachSession?: boolean;
  runPlan?: RunPlan;
  outputDir?: string;
}): Promise<GraphBranch> => {
  const parsed = createBranchRequestSchema.parse(payload);

  let reasoning: { runId: string; content: string }[] | undefined;
  if (parsed.runId) {
    reasoning = await snapshotBranchReasoningFromStore(parsed.runId, parsed.graph.projectName);
  }

  let branch = createBranchGraph({
    graph: parsed.graph,
    name: parsed.name,
    description: parsed.description,
    parentBranchId: parsed.parentBranchId
  });

  if (reasoning && reasoning.length > 0) {
    // Attach reasoning snapshots to branch metadata (typed as any to handle optional metadata field)
    (branch as any).metadata = {
      ...(branch as any).metadata,
      reasoning: reasoning.map((r) => ({
        runId: r.runId,
        content: r.content,
        savedAt: new Date().toISOString()
      }))
    };
  }

  // v0.3.0: attach observability
  if (parsed.attachObservability) {
    branch = await attachObservabilitySnapshot(branch, parsed.graph.projectName);
  }

  // v0.3.0: attach risk report
  if (parsed.attachRisk) {
    if (!parsed.runPlan) {
      throw new Error("attachRisk requires runPlan to be provided");
    }
    branch = await attachRiskReport(branch, parsed.runPlan, parsed.outputDir);
  }

  // v0.3.0: attach session
  if (parsed.attachSession) {
    branch = await attachSessionSnapshot(branch, parsed.graph.projectName);
  }

  return saveBranch(branch);
};

export const getBranch = async (
  projectName: string,
  branchId: string
): Promise<GraphBranch | null> => {
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`getBranch: projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  if (typeof branchId !== "string" || branchId.trim().length === 0) {
    throw new Error(`getBranch: branchId must be a non-empty string; received: ${JSON.stringify(branchId)}`);
  }
  return loadBranch(projectName, branchId);
};

export const removeBranch = async (
  projectName: string,
  branchId: string
): Promise<void> => {
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`removeBranch: projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  if (typeof branchId !== "string" || branchId.trim().length === 0) {
    throw new Error(`removeBranch: branchId must be a non-empty string; received: ${JSON.stringify(branchId)}`);
  }
  return deleteBranch(projectName, branchId);
};

/**
 * Load all reasoning checkpoints for a run and return as branch reasoning snapshots.
 * Uses codeflow-store's reasoning module to load checkpoints.
 */
const snapshotBranchReasoningFromStore = async (
  runId: string,
  projectName: string
): Promise<{ runId: string; content: string }[]> => {
  try {
    const { loadReasoningForRun } = await import("@abhinav2203/codeflow-store/reasoning");
    const checkpoints = await loadReasoningForRun(runId, projectName);
    return checkpoints.map((cp: { runId: string; content: string }) => ({
      runId: cp.runId,
      content: cp.content
    }));
  } catch {
    return [];
  }
};
