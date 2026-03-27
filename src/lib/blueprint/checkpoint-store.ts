import fs from "node:fs/promises";
import path from "node:path";

import { checkpointPath } from "@/lib/blueprint/store-paths";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const createCheckpointIfNeeded = async (
  targetDir: string,
  checkpointId: string
): Promise<string | undefined> => {
  const exists = await fs
    .stat(/* turbopackIgnore: true */ targetDir)
    .then((stats) => stats.isDirectory())
    .catch(() => false);

  if (!exists) {
    return undefined;
  }

  const entries = await fs.readdir(/* turbopackIgnore: true */ targetDir);
  if (entries.length === 0) {
    return undefined;
  }

  const checkpointDir = checkpointPath(checkpointId);
  await ensureDir(path.dirname(checkpointDir));
  await fs.cp(/* turbopackIgnore: true */ targetDir, checkpointDir, {
    recursive: true,
    force: true
  });

  return checkpointDir;
};
