import fs from "node:fs/promises";
import path from "node:path";
import { branchDirForProject, branchPath } from "../shared/utils.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
export const saveBranch = async (branch) => {
    if (branch == null) {
        throw new Error("branch is required; received null");
    }
    // Normalize common caller mistakes: branchName → name, projectId → projectName
    const normalized = {
        ...branch,
        name: branch.name ?? branch.branchName ?? branch.id,
        projectName: branch.projectName ?? branch.projectId ?? branch.projectName
    };
    const filePath = branchPath(normalized.projectName, normalized.id);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
};
export const loadBranch = async (projectName, branchId) => {
    if (typeof projectName !== "string" || projectName.trim().length === 0) {
        throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
    }
    if (typeof branchId !== "string" || branchId.trim().length === 0) {
        throw new Error(`branchId must be a non-empty string; received: ${JSON.stringify(branchId)}`);
    }
    try {
        const content = await fs.readFile(branchPath(projectName, branchId), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
};
export const loadBranches = async (projectName) => {
    if (typeof projectName !== "string" || projectName.trim().length === 0) {
        throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
    }
    const dir = branchDirForProject(projectName);
    try {
        const entries = await fs.readdir(dir);
        const branches = await Promise.all(entries
            .filter((entry) => entry.endsWith(".json"))
            .map(async (entry) => {
            try {
                const content = await fs.readFile(path.join(dir, entry), "utf8");
                return JSON.parse(content);
            }
            catch {
                return null;
            }
        }));
        return branches
            .filter((branch) => branch !== null)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    catch {
        return [];
    }
};
export const deleteBranch = async (projectName, branchId) => {
    try {
        await fs.unlink(branchPath(projectName, branchId));
    }
    catch {
        // Ignore already-removed branches.
    }
};
//# sourceMappingURL=index.js.map