import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { RunRecord } from "@/lib/blueprint/schema";
import { runPath } from "@/lib/blueprint/store-paths";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const createRunId = (): string => crypto.randomUUID();

export const saveRunRecord = async (runRecord: RunRecord): Promise<void> => {
  const filePath = runPath(runRecord.id);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(runRecord, null, 2)}\n`, "utf8");
};
