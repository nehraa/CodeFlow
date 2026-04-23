import path from "node:path";
import os from "node:os";

import {
  CodeRag,
  createCodeRag,
  loadSerializableConfig,
  resolveRuntimeConfig
} from "@abhinav2203/coderag";

// Inline getStoreRoot implementation (same as @abhinav2203/codeflow-store/shared/utils)
const resolveDefaultStoreRoot = (): string => {
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return path.join(
      process.cwd(),
      ".codeflow-store-test",
      `worker-${process.env.VITEST_WORKER_ID ?? "0"}`
    );
  }
  return path.join(os.homedir(), ".codeflow-store");
};

const getStoreRoot = (): string =>
  process.env.CODEFLOW_STORE_ROOT
    ? path.resolve(process.env.CODEFLOW_STORE_ROOT)
    : resolveDefaultStoreRoot();

// Replicate branchDirForProject locally (same logic as @abhinav2203/codeflow-store/shared/utils)
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "node";

const branchDirForProject = (projectName: string): string =>
  path.join(getStoreRoot(), "branches", slugify(projectName));

let instance: CodeRag | null = null;

export interface CodeRagConfig {
  projectName: string;
  repoPath: string;
  docsPath?: string;
  embeddingProvider?: "local-hash" | "gemini";
}

export const initCodeRagForProject = async (config: CodeRagConfig): Promise<CodeRag> => {
  const { projectName, repoPath, docsPath, embeddingProvider = "local-hash" } = config;
  const resolvedRepoPath = path.resolve(repoPath);
  const resolvedDocsPath = docsPath ? path.resolve(docsPath) : undefined;
  const storageRoot = path.join(branchDirForProject(projectName), ".coderag");

  const serializableConfig = await loadSerializableConfig(process.cwd(), undefined);

  serializableConfig.repoPath = resolvedRepoPath;
  serializableConfig.storageRoot = storageRoot;
  serializableConfig.docsPath = resolvedDocsPath;
  serializableConfig.embedding.provider = embeddingProvider;

  const runtimeConfig = resolveRuntimeConfig(serializableConfig, process.cwd());

  if (instance) {
    await instance.close().catch(() => undefined);
  }

  instance = createCodeRag(runtimeConfig);
  await instance.index({ docsPath: resolvedDocsPath });
  return instance;
};

export const getCodeRagInstance = (): CodeRag | null => instance;

export const closeCodeRagInstance = async (): Promise<void> => {
  if (instance) {
    await instance.close().catch(() => undefined);
    instance = null;
  }
};