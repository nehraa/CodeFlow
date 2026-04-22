import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { RunRecord } from "@abhinav2203/codeflow-core/schema";
import { runRecordSchema } from "@abhinav2203/codeflow-core/schema";
import { runPath } from "../shared/utils.js";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const createRunId = (): string => crypto.randomUUID();

export const saveRunRecord = async (runRecord: RunRecord): Promise<void> => {
  const filePath = runPath(runRecord.id);
  await ensureDir(path.dirname(filePath));
  const validated = runRecordSchema.parse(runRecord);
  await fs.writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
};
