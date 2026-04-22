import type { BlueprintGraph, ExecutionReport, ExportResult, PersistedSession, RiskReport, RunPlan } from "@abhinav2203/codeflow-core/schema";
export declare const createSessionId: (hint?: string) => string;
export declare const saveSession: (session: PersistedSession) => Promise<PersistedSession>;
export declare const loadLatestSession: (projectName: string, _branchName?: string) => Promise<PersistedSession | null>;
export declare const upsertSession: ({ projectName, sessionId, graph, runPlan, repoPath, lastRiskReport, lastExportResult, lastExecutionReport, approvalId }: {
    projectName?: string;
    sessionId?: string;
    graph: BlueprintGraph;
    runPlan: RunPlan;
    repoPath?: string;
    lastRiskReport?: RiskReport;
    lastExportResult?: ExportResult;
    lastExecutionReport?: ExecutionReport;
    approvalId?: string;
}) => Promise<PersistedSession>;
//# sourceMappingURL=index.d.ts.map