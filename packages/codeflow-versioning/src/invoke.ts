import { z } from "zod";
import { createBranchId, createBranch as createBranchGraph, diffBranches } from "./branch/index";
import { saveBranch, loadBranch, loadBranches, deleteBranch } from "./store/index";
import {
  blueprintGraphSchema,
  type BlueprintGraph,
  type GraphBranch
} from "@abhinav2203/codeflow-core/schema";

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
  runId: z.string().optional()
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
}): Promise<GraphBranch> => {
  const parsed = createBranchRequestSchema.parse(payload);

  let reasoning: { runId: string; content: string }[] | undefined;
  if (parsed.runId) {
    reasoning = await snapshotBranchReasoningFromStore(parsed.runId, parsed.graph.projectName);
  }

  const branch = createBranchGraph({
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
