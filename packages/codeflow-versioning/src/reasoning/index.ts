import { recoverRun } from "@abhinav2203/codeflow-store/checkpoint";
import { loadReasoningForProject } from "@abhinav2203/codeflow-store/reasoning";

// ReasoningCheckpoint is defined in checkpoint/reasoning but not re-exported via
// the package's public exports. Reconstruct the type from the reasoning module's
// ReasoningSummary shape since it contains the same checkpoint structure.
interface ReasoningCheckpoint {
  runId: string;
  projectName: string;
  taskId: string;
  content: string;
  savedAt: string;
}

export interface BranchReasoningSnapshot {
  runId: string;
  projectName: string;
  checkpoints: ReasoningCheckpoint[];
  savedAt: string;
}

/**
 * Loads reasoning checkpoints for a specific run and project, returning a snapshot.
 */
export const snapshotBranchReasoning = async (
  runId: string,
  projectName: string
): Promise<BranchReasoningSnapshot> => {
  const checkpoints = await recoverRun(runId, projectName);
  return {
    runId,
    projectName,
    checkpoints,
    savedAt: new Date().toISOString()
  };
};

/**
 * Loads all reasoning snapshots across all runs for a given project.
 */
export const loadBranchReasoningHistory = async (
  projectName: string
): Promise<BranchReasoningSnapshot[]> => {
  const summaries = await loadReasoningForProject(projectName);
  return summaries.map((summary) => ({
    runId: summary.runId,
    projectName: summary.projectName,
    checkpoints: summary.checkpoints,
    savedAt: new Date().toISOString()
  }));
};

/**
 * Formats a reasoning snapshot as a human-readable string.
 */
export const summarizeReasoningForBranch = (
  snapshot: BranchReasoningSnapshot
): string => {
  const lines: string[] = [
    `=== Reasoning Snapshot ===`,
    `Run: ${snapshot.runId}`,
    `Project: ${snapshot.projectName}`,
    `Saved: ${snapshot.savedAt}`,
    `Checkpoints: ${snapshot.checkpoints.length}`,
    ""
  ];

  if (snapshot.checkpoints.length === 0) {
    lines.push("(no checkpoints)");
    return lines.join("\n");
  }

  for (const cp of snapshot.checkpoints) {
    lines.push(`--- Task: ${cp.taskId} (saved at ${cp.savedAt}) ---`);
    lines.push(cp.content);
    lines.push("");
  }

  return lines.join("\n");
}
