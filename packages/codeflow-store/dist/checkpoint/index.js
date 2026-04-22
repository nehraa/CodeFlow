import fs from "node:fs/promises";
import path from "node:path";
import { checkpointPath } from "../shared/utils.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
export const createCheckpointIfNeeded = async (targetDir, checkpointId) => {
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
    const checkpointDir = checkpointPath(checkpointId);
    await ensureDir(path.dirname(checkpointDir));
    await fs.cp(targetDir, checkpointDir, {
        recursive: true,
        force: true
    });
    return checkpointDir;
};
//# sourceMappingURL=index.js.map