import fs from "node:fs/promises";
import path from "node:path";

import type { ExportResult } from "@/lib/blueprint/schema";

type DiffEntry = {
  path: string;
  status: "added" | "changed" | "unchanged";
};

const listFiles = async (rootDir: string): Promise<string[]> => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(fullPath);
      }

      return [fullPath];
    })
  );

  return files.flat();
};

const fileHash = async (filePath: string): Promise<string> =>
  fs
    .readFile(filePath, "utf8")
    .catch(() => "")
    .then((content) => content);

export const createSandboxDir = async (runId: string): Promise<string> => {
  const sandboxDir = path.resolve(process.cwd(), ".codeflow-sandboxes", runId);
  await fs.mkdir(sandboxDir, { recursive: true });
  return sandboxDir;
};

export const writeDiffManifest = async ({
  sandboxResult,
  targetDir
}: {
  sandboxResult: ExportResult;
  targetDir: string;
}): Promise<string> => {
  const sandboxFiles = await listFiles(sandboxResult.rootDir);
  const diffEntries: DiffEntry[] = [];

  for (const filePath of sandboxFiles) {
    const relativePath = path.relative(sandboxResult.rootDir, filePath);
    const targetPath = path.join(targetDir, relativePath);
    const targetExists = await fs
      .stat(targetPath)
      .then((stats) => stats.isFile())
      .catch(() => false);
    const sandboxContent = await fileHash(filePath);
    const targetContent = targetExists ? await fileHash(targetPath) : "";

    diffEntries.push({
      path: relativePath,
      status: !targetExists ? "added" : sandboxContent === targetContent ? "unchanged" : "changed"
    });
  }

  const diffPath = path.join(sandboxResult.rootDir, "diff.json");
  await fs.writeFile(diffPath, `${JSON.stringify(diffEntries, null, 2)}\n`, "utf8");
  return diffPath;
};

export const syncSandboxToTarget = async ({
  sandboxDir,
  targetDir
}: {
  sandboxDir: string;
  targetDir: string;
}): Promise<void> => {
  await fs.mkdir(targetDir, { recursive: true });
  await fs.cp(sandboxDir, targetDir, { recursive: true, force: true });
};
