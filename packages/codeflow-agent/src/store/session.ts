import {
  createSessionId,
  saveSession,
  loadLatestSession,
  upsertSession as storeUpsertSession
} from '@abhinav2203/codeflow-store/session';
import type {
  PersistedSession,
  ExecutionReport,
  BlueprintGraph,
  RunPlan
} from '@abhinav2203/codeflow-core/schema';

/**
 * Wrapper around codeflow-store session APIs with additional orchestration semantics.
 * Saves task results, execution reports, and orchestration state to persistent sessions.
 */
export class CodeflowSessionStore {
  /**
   * Create a new session ID for a project.
   */
  async createSession(projectName: string): Promise<string> {
    return createSessionId(projectName);
  }

  /**
   * Persist a full session state to disk.
   */
  async saveSessionState(session: PersistedSession): Promise<void> {
    await saveSession(session);
  }

  /**
   * Load the latest session for a project, if one exists.
   */
  async loadSession(projectName: string): Promise<PersistedSession | null> {
    return loadLatestSession(projectName);
  }

  /**
   * Update only the execution report within an existing session.
   */
  async updateExecutionReport(
    projectName: string,
    executionReport: ExecutionReport
  ): Promise<void> {
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
  async upsertSession(params: {
    projectName?: string;
    sessionId?: string;
    graph: BlueprintGraph;
    runPlan: RunPlan;
    repoPath?: string;
    lastExecutionReport?: ExecutionReport;
    approvalId?: string;
  }): Promise<PersistedSession> {
    return storeUpsertSession(params);
  }
}