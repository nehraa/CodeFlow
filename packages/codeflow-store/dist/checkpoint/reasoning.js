import fs from "node:fs/promises";
import path from "node:path";
import { reasoningCheckpointDir } from "../shared/utils.js";
const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
export const saveTaskReasoningCheckpoint = async (runId, projectName, taskId, content) => {
    if (typeof runId !== "string" || runId.trim().length === 0) {
        throw new Error(`runId must be a non-empty string; received: ${JSON.stringify(runId)}`);
    }
    if (typeof projectName !== "string" || projectName.trim().length === 0) {
        throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
    }
    if (typeof taskId !== "string" || taskId.trim().length === 0) {
        throw new Error(`taskId must be a non-empty string; received: ${JSON.stringify(taskId)}`);
    }
    if (content == null) {
        throw new Error(`content is required; received: ${JSON.stringify(content)}`);
    }
    const dir = path.join(reasoningCheckpointDir(runId), slugify(projectName));
    await ensureDir(dir);
    const cp = {
        runId,
        projectName,
        taskId,
        content,
        savedAt: new Date().toISOString()
    };
    await fs.writeFile(path.join(dir, `${taskId}.json`), JSON.stringify(cp, null, 2), "utf8");
    return cp;
};
export const loadTaskReasoningCheckpoint = async (runId, projectName, taskId) => {
    if (typeof runId !== "string" || runId.trim().length === 0) {
        throw new Error(`runId must be a non-empty string; received: ${JSON.stringify(runId)}`);
    }
    if (typeof projectName !== "string" || projectName.trim().length === 0) {
        throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
    }
    if (typeof taskId !== "string" || taskId.trim().length === 0) {
        throw new Error(`taskId must be a non-empty string; received: ${JSON.stringify(taskId)}`);
    }
    const slugified = slugify(projectName);
    const filePath = path.join(reasoningCheckpointDir(runId), slugified, `${taskId}.json`);
    try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    }
    catch {
        return null;
    }
};
export const recoverRun = async (runId, projectName) => {
    const dir = path.join(reasoningCheckpointDir(runId), slugify(projectName));
    let entries;
    try {
        entries = await fs.readdir(dir);
    }
    catch {
        return [];
    }
    const checkpoints = [];
    for (const entry of entries) {
        if (!entry.endsWith(".json"))
            continue;
        try {
            const content = await fs.readFile(path.join(dir, entry), "utf8");
            checkpoints.push(JSON.parse(content));
        }
        catch {
            // skip malformed
        }
    }
    return checkpoints.sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
};
export const clearTaskReasoningCheckpoint = async (runId, projectName, taskId) => {
    if (typeof runId !== "string" || runId.trim().length === 0) {
        throw new Error(`runId must be a non-empty string; received: ${JSON.stringify(runId)}`);
    }
    if (projectName != null && (typeof projectName !== "string" || projectName.trim().length === 0)) {
        throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
    }
    if (taskId != null && (typeof taskId !== "string" || taskId.trim().length === 0)) {
        throw new Error(`taskId must be a non-empty string; received: ${JSON.stringify(taskId)}`);
    }
    if (!projectName) {
        return 0; // nothing to clear without projectName
    }
    const dir = path.join(reasoningCheckpointDir(runId), slugify(projectName));
    let entries;
    try {
        entries = await fs.readdir(dir);
    }
    catch {
        return 0;
    }
    let deleted = 0;
    for (const entry of entries) {
        if (!entry.endsWith(".json"))
            continue;
        if (taskId !== undefined && entry !== `${taskId}.json`)
            continue;
        try {
            await fs.unlink(path.join(dir, entry));
            deleted++;
        }
        catch {
            // skip
        }
    }
    return deleted;
};
//# sourceMappingURL=reasoning.js.map