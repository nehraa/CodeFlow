import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { reasoningCheckpointDir } from "../shared/utils.js";

export const reasoningCheckpointSchema = z.object({
  runId: z.string(),
  projectName: z.string(),
  taskId: z.string(),
  content: z.string(),
  savedAt: z.string()
});

export interface ReasoningCheckpoint extends z.infer<typeof reasoningCheckpointSchema> {}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const saveTaskReasoningCheckpoint = async (
  runId: string,
  projectName: string,
  taskId: string,
  content: string
): Promise<ReasoningCheckpoint> => {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    throw new Error(`runId must be a non-empty string; received: ${JSON.stringify(runId)}`);
  }
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  if (typeof taskId !== "string" || taskId.trim().length === 0) {
    throw new Error(`taskId must be a non-empty string; received: ${JSON.stringify(taskId)}`);
  }
  if (content == null) {
    throw new Error(`content is required; received: ${JSON.stringify(content)}`);
  }
  const dir = path.join(reasoningCheckpointDir(runId), slugify(projectName));
  await ensureDir(dir);
  const cp: ReasoningCheckpoint = {
    runId,
    projectName,
    taskId,
    content,
    savedAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(dir, `${taskId}.json`), JSON.stringify(cp, null, 2), "utf8");
  return cp;
};

export const loadTaskReasoningCheckpoint = async (
  runId: string,
  projectName: string,
  taskId: string
): Promise<ReasoningCheckpoint | null> => {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    throw new Error(`runId must be a non-empty string; received: ${JSON.stringify(runId)}`);
  }
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  if (typeof taskId !== "string" || taskId.trim().length === 0) {
    throw new Error(`taskId must be a non-empty string; received: ${JSON.stringify(taskId)}`);
  }
  const slugified = slugify(projectName);
  const filePath = path.join(reasoningCheckpointDir(runId), slugified, `${taskId}.json`);
  try {
    return reasoningCheckpointSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8")));
  } catch {
    return null;
  }
};

export const recoverRun = async (
  runId: string,
  projectName: string
): Promise<ReasoningCheckpoint[]> => {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    throw new Error(`recoverRun: runId must be a non-empty string; received: ${JSON.stringify(runId)}`);
  }
  if (typeof projectName !== "string") {
    throw new Error(`recoverRun: projectName must be a string; received: ${JSON.stringify(projectName)} (type: ${typeof projectName})`);
  }
  const dir = path.join(reasoningCheckpointDir(runId), slugify(projectName));
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const checkpoints: ReasoningCheckpoint[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    try {
      const parsed = reasoningCheckpointSchema.parse(JSON.parse(await fs.readFile(path.join(dir, entry), "utf8")));
      checkpoints.push(parsed);
    } catch {
      // skip malformed
    }
  }
  return checkpoints.sort(
    (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
  );
};

export const clearTaskReasoningCheckpoint = async (
  runId: string,
  projectName?: string,
  taskId?: string
): Promise<number> => {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    throw new Error(`runId must be a non-empty string; received: ${JSON.stringify(runId)}`);
  }
  if (projectName != null && (typeof projectName !== "string" || projectName.trim().length === 0)) {
    throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
  if (taskId != null && (typeof taskId !== "string" || taskId.trim().length === 0)) {
    throw new Error(`taskId must be a non-empty string; received: ${JSON.stringify(taskId)}`);
  }
  if (!projectName) {
    return 0; // nothing to clear without projectName
  }
  const dir = path.join(reasoningCheckpointDir(runId), slugify(projectName));
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }
  let deleted = 0;
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    if (taskId !== undefined && entry !== `${taskId}.json`) continue;
    try {
      await fs.unlink(path.join(dir, entry));
      deleted++;
    } catch {
      // skip
    }
  }
  return deleted;
};
