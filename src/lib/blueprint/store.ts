import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  ApprovalRecord,
  BlueprintGraph,
  ExecutionReport,
  ExportResult,
  GraphBranch,
  ObservabilitySnapshot,
  PersistedSession,
  RiskReport,
  RunPlan,
  RunRecord
} from "@/lib/blueprint/schema";
import { blueprintGraphSchema } from "@/lib/blueprint/schema";
import { slugify } from "@/lib/blueprint/utils";

const getStoreRoot = (): string =>
  path.resolve(process.env.CODEFLOW_STORE_ROOT ?? path.join(process.cwd(), ".codeflow-store"));

const sessionDirForProject = (projectName: string): string =>
  path.join(getStoreRoot(), "sessions", slugify(projectName));

const latestSessionPath = (projectName: string): string =>
  path.join(sessionDirForProject(projectName), "latest.json");

const approvalPath = (approvalId: string): string =>
  path.join(getStoreRoot(), "approvals", `${approvalId}.json`);

const runPath = (runId: string): string =>
  path.join(getStoreRoot(), "runs", `${runId}.json`);

const checkpointPath = (checkpointId: string): string =>
  path.join(getStoreRoot(), "checkpoints", checkpointId);

const observabilityPath = (projectName: string): string =>
  path.join(getStoreRoot(), "observability", `${slugify(projectName)}.json`);

const branchDirForProject = (projectName: string): string =>
  path.join(getStoreRoot(), "branches", slugify(projectName));

const branchPath = (projectName: string, branchId: string): string =>
  path.join(branchDirForProject(projectName), `${branchId}.json`);

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const readJson = async <T>(filePath: string): Promise<T | null> => {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

export const createSessionId = (): string => crypto.randomUUID();
export const createRunId = (): string => crypto.randomUUID();
export const createApprovalId = (): string => crypto.randomUUID();

export const saveSession = async (session: PersistedSession): Promise<void> => {
  await ensureDir(sessionDirForProject(session.projectName));
  await writeJson(latestSessionPath(session.projectName), session);
  await writeJson(path.join(sessionDirForProject(session.projectName), "history", `${session.sessionId}.json`), session);
};

export const loadLatestSession = async (projectName: string): Promise<PersistedSession | null> =>
  readJson<PersistedSession>(latestSessionPath(projectName)).then((session) =>
    session
      ? {
          ...session,
          graph: blueprintGraphSchema.parse(session.graph)
        }
      : null
  );

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

export const saveRunRecord = async (runRecord: RunRecord): Promise<void> => {
  await writeJson(runPath(runRecord.id), runRecord);
};

export const createApprovalRecord = async ({
  projectName,
  fingerprint,
  outputDir,
  runPlan,
  riskReport
}: {
  projectName: string;
  fingerprint: string;
  outputDir: string;
  runPlan: RunPlan;
  riskReport: RiskReport;
}): Promise<ApprovalRecord> => {
  const record: ApprovalRecord = {
    id: createApprovalId(),
    action: "export",
    projectName,
    status: "pending",
    fingerprint,
    requestedAt: new Date().toISOString(),
    outputDir,
    runPlan,
    riskReport
  };

  await writeJson(approvalPath(record.id), record);
  return record;
};

export const getApprovalRecord = async (approvalId: string): Promise<ApprovalRecord | null> =>
  readJson<ApprovalRecord>(approvalPath(approvalId));

export const approveRecord = async (approvalId: string): Promise<ApprovalRecord> => {
  const existing = await getApprovalRecord(approvalId);
  if (!existing) {
    throw new Error(`Approval ${approvalId} was not found.`);
  }

  const approved: ApprovalRecord = {
    ...existing,
    status: "approved",
    approvedAt: new Date().toISOString()
  };

  await writeJson(approvalPath(approvalId), approved);
  return approved;
};

export const createCheckpointIfNeeded = async (
  targetDir: string,
  checkpointId: string
): Promise<string | undefined> => {
  const exists = await fs
    .stat(targetDir)
    .then((stats) => stats.isDirectory())
    .catch(() => false);

  if (!exists) {
    return undefined;
  }

  const entries = await fs.readdir(targetDir);
  if (entries.length === 0) {
    return undefined;
  }

  const checkpointDir = checkpointPath(checkpointId);
  await ensureDir(path.dirname(checkpointDir));
  await fs.cp(targetDir, checkpointDir, { recursive: true, force: true });
  return checkpointDir;
};

export const loadObservabilitySnapshot = async (
  projectName: string
): Promise<ObservabilitySnapshot | null> => readJson<ObservabilitySnapshot>(observabilityPath(projectName));

export const mergeObservabilitySnapshot = async ({
  projectName,
  spans,
  logs,
  graph
}: {
  projectName: string;
  spans: ObservabilitySnapshot["spans"];
  logs: ObservabilitySnapshot["logs"];
  graph?: BlueprintGraph;
}): Promise<ObservabilitySnapshot> => {
  const existing = await loadObservabilitySnapshot(projectName);
  const snapshot: ObservabilitySnapshot = {
    projectName,
    updatedAt: new Date().toISOString(),
    spans: [...(existing?.spans ?? []), ...spans].slice(-500),
    logs: [...(existing?.logs ?? []), ...logs].slice(-500),
    graph: graph ? blueprintGraphSchema.parse(graph) : existing?.graph
  };

  await writeJson(observabilityPath(projectName), snapshot);
  return snapshot;
};

// ── Branch persistence ───────────────────────────────────────────────────────

export const saveBranch = async (branch: GraphBranch): Promise<void> => {
  await ensureDir(branchDirForProject(branch.projectName));
  await writeJson(branchPath(branch.projectName, branch.id), branch);
};

export const loadBranch = async (
  projectName: string,
  branchId: string
): Promise<GraphBranch | null> =>
  readJson<GraphBranch>(branchPath(projectName, branchId));

export const loadBranches = async (projectName: string): Promise<GraphBranch[]> => {
  const dir = branchDirForProject(projectName);
  try {
    const entries = await fs.readdir(dir);
    const branches = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => readJson<GraphBranch>(path.join(dir, entry)))
    );
    return branches
      .filter((b): b is GraphBranch => b !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
};

export const deleteBranch = async (
  projectName: string,
  branchId: string
): Promise<void> => {
  try {
    await fs.unlink(branchPath(projectName, branchId));
  } catch {
    // ignore if already gone
  }
};
