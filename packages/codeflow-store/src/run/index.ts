import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { RunRecord } from "@abhinav2203/codeflow-core/schema";
import { runRecordSchema } from "@abhinav2203/codeflow-core/schema";
import { runPath } from "../shared/utils.js";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const createRunId = (projectId?: unknown): string => {
  if (projectId !== undefined) {
    throw new Error(`createRunId takes no arguments; received: ${JSON.stringify(projectId)}`);
  }
  return crypto.randomUUID();
};

export const saveRunRecord = async (runRecord: RunRecord): Promise<RunRecord> => {
  if (runRecord == null) {
    throw new Error("runRecord is required; received null");
  }
  if (typeof (runRecord as any).runId === "string") {
    throw new Error("runRecord.runId is not valid — use runRecord.id");
  }
  const validated = runRecordSchema.parse(runRecord);
  const filePath = runPath(validated.id);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
};
