import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  BlueprintGraph,
  ExecutionReport,
  ExportResult,
  PersistedSession,
  RiskReport,
  RunPlan
} from "@/lib/blueprint/schema";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";
import { latestSessionPath, sessionDirForProject, sessionHistoryPath } from "@/lib/blueprint/store-paths";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

const writeSessionFile = async (filePath: string, session: PersistedSession): Promise<void> => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
};

export const createSessionId = (): string => crypto.randomUUID();

export const saveSession = async (session: PersistedSession): Promise<void> => {
  await ensureDir(sessionDirForProject(session.projectName));
  await writeSessionFile(latestSessionPath(session.projectName), session);
  await writeSessionFile(sessionHistoryPath(session.projectName, session.sessionId), session);
};

export const loadLatestSession = async (projectName: string): Promise<PersistedSession | null> => {
  try {
    const content = await fs.readFile(latestSessionPath(projectName), "utf8");
    const session = JSON.parse(content) as PersistedSession;

    return {
      ...session,
      graph: blueprintGraphSchema.parse(session.graph)
    };
  } catch {
    return null;
  }
};

export const upsertSession = async ({
  graph,
  runPlan,
  lastRiskReport,
  lastExportResult,
  lastExecutionReport,
  approvalId,
  sessionId
}: {
  graph: BlueprintGraph;
  runPlan: RunPlan;
  lastRiskReport?: RiskReport;
  lastExportResult?: ExportResult;
  lastExecutionReport?: ExecutionReport;
  approvalId?: string;
  sessionId?: string;
}): Promise<PersistedSession> => {
  const existing = await loadLatestSession(graph.projectName);
  const normalizedGraph = blueprintGraphSchema.parse(graph);
  const nextSession: PersistedSession = {
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
  };

  await saveSession(nextSession);
  return nextSession;
};
