import os from "node:os";
import path from "node:path";
const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";
const resolveDefaultStoreRoot = () => {
    if (process.env.VITEST || process.env.NODE_ENV === "test") {
        return path.join(process.cwd(), ".codeflow-store-test", `worker-${process.env.VITEST_WORKER_ID ?? "0"}`);
    }
    return path.join(os.homedir(), ".codeflow-store");
};
export const getStoreRoot = () => process.env.CODEFLOW_STORE_ROOT
    ? path.resolve(process.env.CODEFLOW_STORE_ROOT)
    : resolveDefaultStoreRoot();
export const sessionDirForProject = (projectName) => path.join(getStoreRoot(), "sessions", slugify(projectName));
export const latestSessionPath = (projectName) => path.join(sessionDirForProject(projectName), "latest.json");
export const sessionHistoryPath = (projectName, sessionId) => path.join(sessionDirForProject(projectName), "history", `${sessionId}.json`);
export const approvalPath = (approvalId) => path.join(getStoreRoot(), "approvals", `${approvalId}.json`);
export const runPath = (runId) => path.join(getStoreRoot(), "runs", `${runId}.json`);
export const checkpointPath = (checkpointId) => path.join(getStoreRoot(), "checkpoints", checkpointId);
export const observabilityPath = (projectName) => path.join(getStoreRoot(), "observability", `${slugify(projectName)}.json`);
export const branchDirForProject = (projectName) => path.join(getStoreRoot(), "branches", slugify(projectName));
export const branchPath = (projectName, branchId) => {
    const safeBranchId = path.basename(branchId);
    if (safeBranchId !== branchId) {
        throw new Error("Invalid branch ID");
    }
    return path.join(branchDirForProject(projectName), `${safeBranchId}.json`);
};
//# sourceMappingURL=utils.js.map