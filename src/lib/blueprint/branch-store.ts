import fs from "node:fs/promises";
import path from "node:path";

import type { GraphBranch } from "@/lib/blueprint/schema";
import { branchDirForProject, branchPath } from "@/lib/blueprint/store-paths";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const saveBranch = async (branch: GraphBranch): Promise<void> => {
  const filePath = branchPath(branch.projectName, branch.id);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(branch, null, 2)}\n`, "utf8");
};

export const loadBranch = async (
  projectName: string,
  branchId: string
): Promise<GraphBranch | null> => {
  try {
    const content = await fs.readFile(branchPath(projectName, branchId), "utf8");
    return JSON.parse(content) as GraphBranch;
  } catch {
    return null;
  }
};

export const loadBranches = async (projectName: string): Promise<GraphBranch[]> => {
  const dir = branchDirForProject(projectName);

  try {
    const entries = await fs.readdir(dir);
    const branches = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => {
          try {
            const content = await fs.readFile(path.join(dir, entry), "utf8");
            return JSON.parse(content) as GraphBranch;
          } catch {
            return null;
          }
        })
    );

    return branches
      .filter((branch): branch is GraphBranch => branch !== null)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } catch {
    return [];
  }
};

export const deleteBranch = async (projectName: string, branchId: string): Promise<void> => {
  try {
    await fs.unlink(branchPath(projectName, branchId));
  } catch {
    // Ignore already-removed branches.
  }
};
