import { recoverRun } from "@abhinav2203/codeflow-store/checkpoint";
import { loadReasoningForProject } from "@abhinav2203/codeflow-store/reasoning";
/**
 * Loads reasoning checkpoints for a specific run and project, returning a snapshot.
 */
export const snapshotBranchReasoning = async (runId, projectName) => {
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
export const loadBranchReasoningHistory = async (projectName) => {
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
export const summarizeReasoningForBranch = (snapshot) => {
    const lines = [
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
};
