export interface ReasoningCheckpoint {
    runId: string;
    projectName: string;
    taskId: string;
    content: string;
    savedAt: string;
}
export declare const saveTaskReasoningCheckpoint: (runId: string, projectName: string, taskId: string, content: string) => Promise<ReasoningCheckpoint>;
export declare const loadTaskReasoningCheckpoint: (runId: string, projectName: string, taskId: string) => Promise<ReasoningCheckpoint | null>;
export declare const recoverRun: (runId: string, projectName: string) => Promise<ReasoningCheckpoint[]>;
export declare const clearTaskReasoningCheckpoint: (runId: string, projectName?: string, taskId?: string) => Promise<number>;
//# sourceMappingURL=reasoning.d.ts.map