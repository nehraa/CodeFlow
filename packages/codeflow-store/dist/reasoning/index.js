import fs from "node:fs/promises";
import { reasoningBasePath, reasoningCheckpointDir } from "../shared/utils.js";
import { recoverRun, clearTaskReasoningCheckpoint } from "../checkpoint/reasoning.js";
export const loadReasoningForRun = async (runId, projectName) => {
    if (typeof runId !== "string" || runId.trim().length === 0) {
        throw new Error(`loadReasoningForRun: runId must be a non-empty string; received: ${JSON.stringify(runId)}`);
    }
    if (projectName != null && typeof projectName !== "string") {
        throw new Error(`loadReasoningForRun: projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
    }
    if (projectName) {
        return recoverRun(runId, projectName);
    }
    // projectName omitted — collect from all project directories under this runId
    const runDir = reasoningCheckpointDir(runId);
    let entries;
    try {
        entries = await fs.readdir(runDir);
    }
    catch {
        return [];
    }
    const all = [];
    for (const projectSlug of entries) {
        const checkpoints = await recoverRun(runId, projectSlug);
        all.push(...checkpoints);
    }
    return all.sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
};
export const loadReasoningForProject = async (projectName) => {
    if (typeof projectName !== "string" || projectName.trim().length === 0) {
        throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
    }
    const reasoningRoot = reasoningBasePath();
    let runIds;
    try {
        runIds = await fs.readdir(reasoningRoot);
    }
    catch {
        return [];
    }
    const summaries = [];
    for (const runId of runIds) {
        const checkpoints = await recoverRun(runId, projectName);
        if (checkpoints.length > 0) {
            summaries.push({ runId, projectName, checkpoints });
        }
    }
    return summaries;
};
export const deleteReasoningForRun = async (runId, projectName) => {
    return clearTaskReasoningCheckpoint(runId, projectName);
};
//# sourceMappingURL=index.js.map