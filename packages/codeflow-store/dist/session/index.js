import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { persistedSessionSchema } from "@abhinav2203/codeflow-core/schema";
import { latestSessionPath, sessionDirForProject, sessionHistoryPath } from "../shared/utils.js";
const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};
const writeSessionFile = async (filePath, session) => {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
};
export const createSessionId = () => crypto.randomUUID();
export const saveSession = async (session) => {
    await ensureDir(sessionDirForProject(session.projectName));
    await writeSessionFile(latestSessionPath(session.projectName), session);
    await writeSessionFile(sessionHistoryPath(session.projectName, session.sessionId), session);
};
export const loadLatestSession = async (projectName) => {
    try {
        const content = await fs.readFile(latestSessionPath(projectName), "utf8");
        return persistedSessionSchema.parse(JSON.parse(content));
    }
    catch {
        return null;
    }
};
export const upsertSession = async ({ graph, runPlan, lastRiskReport, lastExportResult, lastExecutionReport, approvalId, sessionId }) => {
    const existing = await loadLatestSession(graph.projectName);
    const normalizedGraph = persistedSessionSchema.shape.graph.parse(graph);
    const nextSession = persistedSessionSchema.parse({
        sessionId: sessionId ?? existing?.sessionId ?? createSessionId(),
        projectName: normalizedGraph.projectName,
        updatedAt: new Date().toISOString(),
        graph: normalizedGraph,
        runPlan,
        lastRiskReport: lastRiskReport ?? existing?.lastRiskReport,
        lastExportResult: lastExportResult ?? existing?.lastExportResult,
        lastExecutionReport: lastExecutionReport ?? existing?.lastExecutionReport,
        approvalIds: approvalId
            ? [...new Set([...(existing?.approvalIds ?? []), approvalId])]
            : (existing?.approvalIds ?? [])
    });
    await saveSession(nextSession);
    return nextSession;
};
//# sourceMappingURL=index.js.map