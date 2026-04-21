import type { ApprovalRecord, RiskReport, RunPlan } from "@abhinav2203/codeflow-core/schema";
export declare const createApprovalId: () => string;
export declare const createApprovalRecord: ({ projectName, fingerprint, outputDir, runPlan, riskReport }: {
    projectName: string;
    fingerprint: string;
    outputDir: string;
    runPlan: RunPlan;
    riskReport: RiskReport;
}) => Promise<ApprovalRecord>;
export declare const getApprovalRecord: (approvalId: string) => Promise<ApprovalRecord | null>;
export declare const approveRecord: (approvalId: string) => Promise<ApprovalRecord>;
//# sourceMappingURL=index.d.ts.map