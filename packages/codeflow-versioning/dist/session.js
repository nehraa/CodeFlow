import { loadLatestSession } from "@abhinav2203/codeflow-store/session";
/**
 * Attach the latest session snapshot to a branch.
 * This preserves the full run state (graph, plan, last risk/export/execution reports)
 * so the branch can be fully reconstructed from the session.
 */
export const attachSessionSnapshot = async (branch, projectName) => {
    const effectiveProjectName = projectName ?? branch.projectName;
    const session = await loadLatestSession(effectiveProjectName);
    if (!session)
        return branch;
    return {
        ...branch,
        metadata: {
            ...(branch.metadata ?? {}),
            session: {
                sessionId: session.sessionId,
                projectName: session.projectName,
                repoPath: session.repoPath,
                graph: session.graph,
                runPlan: session.runPlan,
                lastRiskReport: session.lastRiskReport,
                lastExportResult: session.lastExportResult,
                lastExecutionReport: session.lastExecutionReport,
                approvalIds: session.approvalIds,
                updatedAt: session.updatedAt
            }
        }
    };
};
