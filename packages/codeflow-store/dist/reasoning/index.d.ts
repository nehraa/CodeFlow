import type { ReasoningCheckpoint } from "../checkpoint/reasoning.js";
export interface ReasoningSummary {
    runId: string;
    projectName: string;
    checkpoints: ReasoningCheckpoint[];
}
export declare const loadReasoningForRun: (runId: string, projectName?: string) => Promise<ReasoningCheckpoint[]>;
export declare const loadReasoningForProject: (projectName: string) => Promise<ReasoningSummary[]>;
export declare const deleteReasoningForRun: (runId: string, projectName: string) => Promise<number>;
//# sourceMappingURL=index.d.ts.map