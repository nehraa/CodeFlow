interface ReasoningCheckpoint {
    runId: string;
    projectName: string;
    taskId: string;
    content: string;
    savedAt: string;
}
export interface BranchReasoningSnapshot {
    runId: string;
    projectName: string;
    checkpoints: ReasoningCheckpoint[];
    savedAt: string;
}
/**
 * Loads reasoning checkpoints for a specific run and project, returning a snapshot.
 */
export declare const snapshotBranchReasoning: (runId: string, projectName: string) => Promise<BranchReasoningSnapshot>;
/**
 * Loads all reasoning snapshots across all runs for a given project.
 */
export declare const loadBranchReasoningHistory: (projectName: string) => Promise<BranchReasoningSnapshot[]>;
/**
 * Formats a reasoning snapshot as a human-readable string.
 */
export declare const summarizeReasoningForBranch: (snapshot: BranchReasoningSnapshot) => string;
export {};
//# sourceMappingURL=index.d.ts.map