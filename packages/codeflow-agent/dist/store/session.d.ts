import type { PersistedSession, ExecutionReport, BlueprintGraph, RunPlan } from '@abhinav2203/codeflow-core/schema';
/**
 * Wrapper around codeflow-store session APIs with additional orchestration semantics.
 * Saves task results, execution reports, and orchestration state to persistent sessions.
 */
export declare class CodeflowSessionStore {
    /**
     * Create a new session ID for a project.
     */
    createSession(projectName: string): Promise<string>;
    /**
     * Persist a full session state to disk.
     */
    saveSessionState(session: PersistedSession): Promise<void>;
    /**
     * Load the latest session for a project, if one exists.
     */
    loadSession(projectName: string): Promise<PersistedSession | null>;
    /**
     * Update only the execution report within an existing session.
     */
    updateExecutionReport(projectName: string, executionReport: ExecutionReport): Promise<void>;
    /**
     * Upsert a full session with graph and run plan.
     */
    upsertSession(params: {
        projectName?: string;
        sessionId?: string;
        graph: BlueprintGraph;
        runPlan: RunPlan;
        repoPath?: string;
        lastExecutionReport?: ExecutionReport;
        approvalId?: string;
    }): Promise<PersistedSession>;
}
//# sourceMappingURL=session.d.ts.map