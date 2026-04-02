import os from "node:os";
import path from "node:path";

import { slugify } from "../internal/utils.js";

const resolveDefaultStoreRoot = (): string => {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return path.join(
      process.cwd(),
      ".codeflow-store-test",
      `worker-${process.env.VITEST_WORKER_ID ?? "0"}`
    );
  }

  return path.join(os.homedir(), ".codeflow-store");
};

export const getStoreRoot = (): string =>
  process.env.CODEFLOW_STORE_ROOT
    ? path.resolve(/* turbopackIgnore: true */ process.env.CODEFLOW_STORE_ROOT)
    : resolveDefaultStoreRoot();

export const sessionDirForProject = (projectName: string): string =>
  path.join(getStoreRoot(), "sessions", slugify(projectName));

export const latestSessionPath = (projectName: string): string =>
  path.join(sessionDirForProject(projectName), "latest.json");

export const sessionHistoryPath = (projectName: string, sessionId: string): string =>
  path.join(sessionDirForProject(projectName), "history", `${sessionId}.json`);

export const approvalPath = (approvalId: string): string =>
  path.join(getStoreRoot(), "approvals", `${approvalId}.json`);

export const runPath = (runId: string): string =>
  path.join(getStoreRoot(), "runs", `${runId}.json`);

export const checkpointPath = (checkpointId: string): string =>
  path.join(getStoreRoot(), "checkpoints", checkpointId);

export const observabilityPath = (projectName: string): string =>
  path.join(getStoreRoot(), "observability", `${slugify(projectName)}.json`);

export const branchDirForProject = (projectName: string): string =>
  path.join(getStoreRoot(), "branches", slugify(projectName));

export const branchPath = (projectName: string, branchId: string): string => {
  const safeBranchId = path.basename(branchId);

  if (safeBranchId !== branchId) {
    throw new Error("Invalid branch ID");
  }

  return path.join(branchDirForProject(projectName), `${safeBranchId}.json`);
};
