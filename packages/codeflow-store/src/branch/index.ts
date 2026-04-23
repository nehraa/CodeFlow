import fs from "node:fs/promises";
import path from "node:path";

import type { GraphBranch } from "@abhinav2203/codeflow-core/schema";
import { graphBranchSchema } from "@abhinav2203/codeflow-core/schema";
import { branchDirForProject, branchPath } from "../shared/utils.js";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const saveBranch = async (branch: GraphBranch): Promise<GraphBranch> => {
  if (branch == null) {
    throw new Error("saveBranch: branch is required; received null");
  }
  if (typeof branch !== "object") {
    throw new Error(`branch is required; received: ${JSON.stringify(branch)} (type: ${typeof branch})`);
  }
  if (Array.isArray(branch)) {
    throw new Error(`saveBranch: branch must be an object, not an array`);
  }

  // Normalize common caller mistakes: branchName → name, projectId → projectName
  // Ensure createdAt and graph are always present (required by graphBranchSchema)
  const normalized: GraphBranch = {
    ...branch,
    createdAt: (branch as any).createdAt ?? new Date().toISOString(),
    graph: (branch as any).graph ?? {
      projectName: branch.projectName ?? (branch as any).projectId ?? branch.id,
      mode: "essential" as const,
      phase: "spec" as const,
      generatedAt: (branch as any).createdAt ?? new Date().toISOString(),
      nodes: [],
      edges: [],
      workflows: [],
      warnings: []
    },
    name: branch.name ?? (branch as any).branchName,
    projectName: branch.projectName ?? (branch as any).projectId
  };

  // Validate required fields with clear error messages
  if (!normalized.id || typeof normalized.id !== "string" || normalized.id.trim().length === 0) {
    throw new Error(
      `saveBranch: branch.id is required and must be a non-empty string. ` +
      `Use branch.id or provide a branchName (which becomes branch.name, not branch.id).`
    );
  }
  if (!normalized.name || typeof normalized.name !== "string" || normalized.name.trim().length === 0) {
    throw new Error(
      `saveBranch: branch.name is required and must be a non-empty string. ` +
      `If you passed { projectId, branchName }, note that branchName should be the branch's name field.`
    );
  }
  if (!normalized.projectName || typeof normalized.projectName !== "string" || normalized.projectName.trim().length === 0) {
    throw new Error(
      `saveBranch: branch.projectName is required and must be a non-empty string. ` +
      `If you passed { projectId, branchName }, note that projectId should be projectName.`
    );
  }

  const filePath = branchPath(normalized.projectName, normalized.id);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
};

export const loadBranch = async (
  projectName: string,
  branchId: string
): Promise<GraphBranch | null> => {
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  if (typeof branchId !== "string" || branchId.trim().length === 0) {
    throw new Error(`branchId must be a non-empty string; received: ${JSON.stringify(branchId)}`);
  }
  try {
    const content = await fs.readFile(branchPath(projectName, branchId), "utf8");
    return graphBranchSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
};

export const loadBranches = async (projectName: string): Promise<GraphBranch[]> => {
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  const dir = branchDirForProject(projectName);

  try {
    const entries = await fs.readdir(dir);
    const branches = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => {
          try {
            const content = await fs.readFile(path.join(dir, entry), "utf8");
            return graphBranchSchema.parse(JSON.parse(content));
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
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`deleteBranch: projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  if (typeof branchId !== "string" || branchId.trim().length === 0) {
    throw new Error(`deleteBranch: branchId must be a non-empty string; received: ${JSON.stringify(branchId)}`);
  }
  try {
    await fs.unlink(branchPath(projectName, branchId));
  } catch (err: any) {
    // Re-throw if it's not a "not found" error
    if (err?.code !== "ENOENT") {
      throw err;
    }
    // ENOENT means branch didn't exist - that's acceptable, no-op
  }
};
