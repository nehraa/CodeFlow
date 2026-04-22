import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { approvalPath } from "../shared/utils.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
const writeApprovalFile = async (record) => {
    const filePath = approvalPath(record.id);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
};
export const createApprovalId = () => crypto.randomUUID();
export const createApprovalRecord = async ({ projectName, fingerprint, outputDir, runPlan, riskReport }) => {
    const record = {
        id: createApprovalId(),
        action: "export",
        projectName,
        status: "pending",
        fingerprint,
        requestedAt: new Date().toISOString(),
        outputDir,
        runPlan,
        riskReport
    };
    await writeApprovalFile(record);
    return record;
};
export const getApprovalRecord = async (approvalId) => {
    try {
        const content = await fs.readFile(approvalPath(approvalId), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
};
export const approveRecord = async (approvalId) => {
    const existing = await getApprovalRecord(approvalId);
    if (!existing) {
        throw new Error(`Approval ${approvalId} was not found.`);
    }
    const approved = {
        ...existing,
        status: "approved",
        approvedAt: new Date().toISOString()
    };
    await writeApprovalFile(approved);
    return approved;
};
//# sourceMappingURL=index.js.map