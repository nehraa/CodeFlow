import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const readJson = async <Value>(filePath: string): Promise<Value> => {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as Value;
};

export const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
};

export const hashContent = (content: string): string => createHash("sha256").update(content).digest("hex");

export const hashFile = async (filePath: string): Promise<string> => {
  const content = await fs.readFile(filePath, "utf8");
  return hashContent(content);
};

export const resolveWithin = (basePath: string, targetPath: string): string => {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return path.resolve(basePath, targetPath);
};

export const readTextFile = async (filePath: string): Promise<string> => fs.readFile(filePath, "utf8");
