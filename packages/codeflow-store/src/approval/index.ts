import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { ApprovalRecord, RiskReport, RunPlan } from "@abhinav2203/codeflow-core/schema";
import { approvalPath } from "../shared/utils.js";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

const writeApprovalFile = async (record: ApprovalRecord): Promise<void> => {
  const filePath = approvalPath(record.id);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
};

/**
 * Creates a new unique approval record ID.
 * @param hint - Optional hint to incorporate into the ID. If omitted, a random UUID is generated.
 */
export const createApprovalId = (hint?: string): string => {
  if (hint != null && typeof hint !== "string") {
    throw new Error(`createApprovalId: hint must be a string or omitted; received: ${JSON.stringify(hint)}`);
  }
  if (hint) {
    return `${hint}-${crypto.randomUUID()}`;
  }
  return crypto.randomUUID();
};

export const createApprovalRecord = async ({
  approvalId,
  runId,
  projectName,
  fingerprint,
  outputDir,
  runPlan,
  riskReport,
  status = "pending"
}: {
  approvalId?: string;
  runId?: string;
  projectName: string;
  fingerprint: string;
  outputDir: string;
  runPlan: RunPlan;
  riskReport: RiskReport;
  status?: "pending" | "approved";
}): Promise<ApprovalRecord> => {
  const record: ApprovalRecord = {
    id: approvalId ?? createApprovalId(),
    action: "export",
    projectName,
    status,
    fingerprint,
    requestedAt: new Date().toISOString(),
    outputDir,
    runPlan,
    riskReport,
    ...(runId ? { runId } : {})
  };

  await writeApprovalFile(record);
  return record;
};

export const getApprovalRecord = async (approvalId: string): Promise<ApprovalRecord | null> => {
  if (typeof approvalId !== "string" || approvalId.trim().length === 0) {
    throw new Error(`approvalId must be a non-empty string; received: ${JSON.stringify(approvalId)}`);
  }
  try {
    const content = await fs.readFile(approvalPath(approvalId), "utf8");
    return JSON.parse(content) as ApprovalRecord;
  } catch {
    return null;
  }
};

export const approveRecord = async (approvalId: string, approver: string): Promise<ApprovalRecord> => {
  if (typeof approver !== "string" || approver.trim().length === 0) {
    throw new Error(`approver must be a non-empty string; received: ${JSON.stringify(approver)}`);
  }
  const existing = await getApprovalRecord(approvalId);
  if (!existing) {
    throw new Error(`Approval ${approvalId} was not found.`);
  }

  const approved: ApprovalRecord = {
    ...existing,
    status: "approved",
    approver,
    approvedAt: new Date().toISOString()
  };

  await writeApprovalFile(approved);
  return approved;
};
