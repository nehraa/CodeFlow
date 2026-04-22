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
export const approvalPath = (approvalId) => {
    const safeApprovalId = path.basename(approvalId);
    if (safeApprovalId !== approvalId) {
        throw new Error(`Invalid approval ID: must not contain path separators`);
    }
    return path.join(getStoreRoot(), "approvals", `${safeApprovalId}.json`);
};
export const runPath = (runId) => {
    const safeRunId = path.basename(runId);
    if (safeRunId !== runId) {
        throw new Error(`Invalid run ID: must not contain path separators`);
    }
    return path.join(getStoreRoot(), "runs", `${safeRunId}.json`);
};
export const checkpointPath = (checkpointId) => {
    const safeCheckpointId = path.basename(checkpointId);
    if (safeCheckpointId !== checkpointId) {
        throw new Error(`Invalid checkpoint ID: must not contain path separators`);
    }
    return path.join(getStoreRoot(), "checkpoints", safeCheckpointId);
};
export const observabilityPath = (projectName) => path.join(getStoreRoot(), "observability", `${slugify(projectName)}.json`);
export const reasoningCheckpointDir = (runId) => path.join(getStoreRoot(), "checkpoints", "reasoning", runId);
export const reasoningBasePath = () => path.join(getStoreRoot(), "checkpoints", "reasoning");
export const branchDirForProject = (projectName) => path.join(getStoreRoot(), "branches", slugify(projectName));
export const branchPath = (projectName, branchId) => {
    const safeBranchId = path.basename(branchId);
    if (safeBranchId !== branchId) {
        throw new Error("Invalid branch ID");
    }
    return path.join(branchDirForProject(projectName), `${safeBranchId}.json`);
};
//# sourceMappingURL=utils.js.map