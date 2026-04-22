import fs from "node:fs/promises";
import path from "node:path";
import { branchDirForProject, branchPath } from "../shared/utils.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
export const saveBranch = async (branch) => {
    const filePath = branchPath(branch.projectName, branch.id);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${JSON.stringify(branch, null, 2)}\n`, "utf8");
};
export const loadBranch = async (projectName, branchId) => {
    try {
        const content = await fs.readFile(branchPath(projectName, branchId), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
};
export const loadBranches = async (projectName) => {
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