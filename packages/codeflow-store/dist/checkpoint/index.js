import fs from "node:fs/promises";
import path from "node:path";
import { checkpointPath } from "../shared/utils.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
export const createCheckpointIfNeeded = async (targetDir, checkpointId) => {
    if (typeof targetDir !== "string" || targetDir.trim().length === 0) {
        throw new Error(`createCheckpointIfNeeded: targetDir must be a non-empty string; received: ${JSON.stringify(targetDir)}`);
    }
    if (checkpointId != null && typeof checkpointId !== "string") {
        throw new Error(`createCheckpointIfNeeded: checkpointId must be a string or omitted; received: ${JSON.stringify(checkpointId)}`);
    }
    const exists = await fs
        .stat(targetDir)
        .then((stats) => stats.isDirectory())
        .catch(() => false);
    if (!exists) {
        return undefined;
    }
    const entries = await fs.readdir(targetDir);
    if (entries.length === 0) {
        return undefined;
    }
    // checkpointId is optional - generate one if not provided
    const effectiveCheckpointId = checkpointId ?? `checkpoint-${Date.now()}`;
    const checkpointDir = checkpointPath(effectiveCheckpointId);
    // Prevent copying directory into itself (EINVAL).
    // This happens when checkpointId is an EXISTING subdirectory of targetDir.
    // We check if the path targetDir/checkpointId already exists as a subdirectory
    // of targetDir — if so, cp would read from targetDir and write into a
    // subdirectory of itself, which is EINVAL.
    const resolvedTarget = path.resolve(targetDir);
    const copyDestInsideTarget = path.resolve(targetDir, effectiveCheckpointId);
    if (copyDestInsideTarget.startsWith(resolvedTarget + path.sep)) {
        try {
            const stat = await fs.stat(copyDestInsideTarget);
            if (stat.isDirectory()) {
                throw new Error(`createCheckpointIfNeeded: cannot copy directory into itself or a subdirectory of itself. ` +
                    `targetDir=${targetDir}, checkpointId=${effectiveCheckpointId}`);
            }
            // If it's a file, cp will fail naturally (EISDIR or similar) — continue
        }
        catch (err) {
            if (err?.code !== "ENOENT")
                throw err;
            // Destination doesn't exist yet — safe to create
        }
    }
    await ensureDir(path.dirname(checkpointDir));
    await fs.cp(targetDir, checkpointDir, {
        recursive: true,
        force: true
    });
    return checkpointDir;
};
export { saveTaskReasoningCheckpoint, loadTaskReasoningCheckpoint, recoverRun, clearTaskReasoningCheckpoint } from "./reasoning.js";
//# sourceMappingURL=index.js.map