import type { ApprovalRecord, RiskReport, RunPlan } from "@abhinav2203/codeflow-core/schema";
/**
 * Creates a new unique approval record ID.
 * @param hint - Optional hint to incorporate into the ID. If omitted, a random UUID is generated.
 */
export declare const createApprovalId: (hint?: string) => string;
export declare const createApprovalRecord: ({ approvalId, runId, projectName, fingerprint, outputDir, runPlan, riskReport, status, approver }: {
    approvalId?: string;
    runId?: string;
    projectName: string;
    fingerprint: string;
    outputDir: string;
    runPlan: RunPlan;
    riskReport: RiskReport;
    status?: "pending" | "approved";
    approver?: string;
}) => Promise<ApprovalRecord>;
export declare const getApprovalRecord: (approvalId: string) => Promise<ApprovalRecord | null>;
export declare const approveRecord: (approvalId: string, approver: string) => Promise<ApprovalRecord>;
//# sourceMappingURL=index.d.ts.map