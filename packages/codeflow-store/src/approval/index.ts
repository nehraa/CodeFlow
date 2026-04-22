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

export const createApprovalId = (): string => crypto.randomUUID();

export const createApprovalRecord = async ({
  projectName,
  fingerprint,
  outputDir,
  runPlan,
  riskReport
}: {
  projectName: string;
  fingerprint: string;
  outputDir: string;
  runPlan: RunPlan;
  riskReport: RiskReport;
}): Promise<ApprovalRecord> => {
  const record: ApprovalRecord = {
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

export const getApprovalRecord = async (approvalId: string): Promise<ApprovalRecord | null> => {
  try {
    const content = await fs.readFile(approvalPath(approvalId), "utf8");
    return JSON.parse(content) as ApprovalRecord;
  } catch {
    return null;
  }
};

export const approveRecord = async (approvalId: string): Promise<ApprovalRecord> => {
  const existing = await getApprovalRecord(approvalId);
  if (!existing) {
    throw new Error(`Approval ${approvalId} was not found.`);
  }

  const approved: ApprovalRecord = {
    ...existing,
    status: "approved",
    approvedAt: new Date().toISOString()
  };

  await writeApprovalFile(approved);
  return approved;
};
