import { createSessionId, saveSession, loadLatestSession, upsertSession as storeUpsertSession } from '@abhinav2203/codeflow-store/session';
/**
 * Wrapper around codeflow-store session APIs with additional orchestration semantics.
 * Saves task results, execution reports, and orchestration state to persistent sessions.
 */
export class CodeflowSessionStore {
    /**
     * Create a new session ID for a project.
     */
    async createSession(projectName) {
        return createSessionId(projectName);
    }
    /**
     * Persist a full session state to disk.
     */
    async saveSessionState(session) {
        await saveSession(session);
    }
    /**
     * Load the latest session for a project, if one exists.
     */
    async loadSession(projectName) {
        return loadLatestSession(projectName);
    }
    /**
     * Update only the execution report within an existing session.
     */
    async updateExecutionReport(projectName, executionReport) {
        const session = await loadLatestSession(projectName);
        if (session) {
            await saveSession({
                ...session,
                lastExecutionReport: executionReport,
                updatedAt: new Date().toISOString()
            });
        }
    }
    /**
     * Upsert a full session with graph and run plan.
     */
    async upsertSession(params) {
        return storeUpsertSession(params);
    }
}
