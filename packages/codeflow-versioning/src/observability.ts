import type { ObservabilitySnapshot } from "@abhinav2203/codeflow-core/schema";
import type { GraphBranch } from "@abhinav2203/codeflow-core/schema";
import {
  loadObservabilitySnapshot,
  mergeObservabilitySnapshot
} from "@abhinav2203/codeflow-store/observability";

/**
 * Attach the current observability snapshot for a project to a branch.
 * Call this at branch creation time to preserve the execution trace.
 */
export const attachObservabilitySnapshot = async (
  branch: GraphBranch,
  projectName?: string
): Promise<GraphBranch> => {
  const effectiveProjectName = projectName ?? branch.projectName;
  const snapshot = await loadObservabilitySnapshot(effectiveProjectName);
  if (!snapshot) return branch;

  return {
    ...branch,
    metadata: {
      ...((branch as any).metadata ?? {}),
      observability: snapshot
    }
  } as GraphBranch;
};

/**
 * Merge a new observability snapshot into the branch's attached snapshot.
 * Used when an agent continues work on an existing branch.
 */
export const mergeBranchObservability = async (
  branch: GraphBranch,
  spans?: ObservabilitySnapshot["spans"],
  logs?: ObservabilitySnapshot["logs"],
  projectName?: string
): Promise<ObservabilitySnapshot> => {
  const effectiveProjectName = projectName ?? branch.projectName;
  return mergeObservabilitySnapshot({
    projectName: effectiveProjectName,
    spans,
    logs,
    graph: branch.graph
  });
};