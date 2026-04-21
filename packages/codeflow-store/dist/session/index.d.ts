import type { BlueprintGraph, ExecutionReport, ExportResult, PersistedSession, RiskReport, RunPlan } from "@abhinav2203/codeflow-core/schema";
export declare const createSessionId: () => string;
export declare const saveSession: (session: PersistedSession) => Promise<void>;
export declare const loadLatestSession: (projectName: string) => Promise<PersistedSession | null>;
export declare const upsertSession: ({ graph, runPlan, lastRiskReport, lastExportResult, lastExecutionReport, approvalId, sessionId }: {
    graph: BlueprintGraph;
    runPlan: RunPlan;
    lastRiskReport?: RiskReport;
    lastExportResult?: ExportResult;
    lastExecutionReport?: ExecutionReport;
    approvalId?: string;
    sessionId?: string;
}) => Promise<PersistedSession>;
//# sourceMappingURL=index.d.ts.map