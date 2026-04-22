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
} from "@abhinav2203/codeflow-core/schema";
import { persistedSessionSchema } from "@abhinav2203/codeflow-core/schema";
import { latestSessionPath, sessionDirForProject, sessionHistoryPath } from "../shared/utils.js";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

const writeSessionFile = async (filePath: string, session: PersistedSession): Promise<void> => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
};

export const createSessionId = (hint?: string): string => {
  if (hint != null && typeof hint !== "string") {
    throw new Error(`createSessionId: hint must be a string or omitted; received: ${JSON.stringify(hint)}`);
  }
  if (hint) {
    return `${hint}-${crypto.randomUUID()}`;
  }
  return crypto.randomUUID();
};

export const saveSession = async (session: PersistedSession): Promise<PersistedSession> => {
  if (session == null) {
    throw new Error("session is required; received null");
  }
  if (typeof session.projectName !== "string" || session.projectName.trim().length === 0) {
    throw new Error("session.projectName must be a non-empty string");
  }
  if (typeof session.sessionId !== "string") {
    throw new Error("session.sessionId must be a string");
  }
  await ensureDir(sessionDirForProject(session.projectName));
  await writeSessionFile(latestSessionPath(session.projectName), session);
  await writeSessionFile(sessionHistoryPath(session.projectName, session.sessionId), session);
  return session;
};

export const loadLatestSession = async (
  projectName: string,
  _branchName?: string
): Promise<PersistedSession | null> => {
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  // Note: _branchName is accepted for API compatibility but ignored —
  // sessions are stored per-project, not per-branch in this version.
  try {
    const content = await fs.readFile(latestSessionPath(projectName), "utf8");
    return persistedSessionSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
};

export const upsertSession = async ({
  projectName,
  sessionId,
  graph,
  runPlan,
  repoPath,
  lastRiskReport,
  lastExportResult,
  lastExecutionReport,
  approvalId
}: {
  projectName?: string;
  sessionId?: string;
  graph: BlueprintGraph;
  runPlan: RunPlan;
  repoPath?: string;
  lastRiskReport?: RiskReport;
  lastExportResult?: ExportResult;
  lastExecutionReport?: ExecutionReport;
  approvalId?: string;
}): Promise<PersistedSession> => {
  // projectName is optional — if omitted, derive from graph
  if (projectName != null && (typeof projectName !== "string" || projectName.trim().length === 0)) {
    throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  const effectiveProjectName = projectName ?? graph.projectName;
  const existing = await loadLatestSession(effectiveProjectName);
  const nextSession = persistedSessionSchema.parse({
    sessionId: sessionId ?? existing?.sessionId ?? createSessionId(),
    projectName: effectiveProjectName,
    updatedAt: new Date().toISOString(),
    repoPath: repoPath?.trim() ? path.resolve(repoPath) : existing?.repoPath,
    graph,
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
