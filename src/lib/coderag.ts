import path from "node:path";

import {
  CodeRag,
  createCodeRag,
  loadSerializableConfig,
  resolveRuntimeConfig
} from "@abhinav2203/coderag";

import { getStoreRoot } from "@/lib/blueprint/store-paths";
import { slugify } from "@/lib/blueprint/utils";

let instance: CodeRag | null = null;

export async function initCodeRag(
  projectName: string,
  repoPath: string,
  docsPath?: string
): Promise<CodeRag> {
  const resolvedRepoPath = path.resolve(repoPath);
  const resolvedDocsPath = docsPath ? path.resolve(docsPath) : undefined;
  const storageRoot = path.join(getStoreRoot(), "coderag", slugify(projectName));
  const serializableConfig = await loadSerializableConfig(process.cwd(), undefined);

  serializableConfig.repoPath = resolvedRepoPath;
  serializableConfig.storageRoot = storageRoot;
  serializableConfig.docsPath = resolvedDocsPath;
  serializableConfig.embedding.provider = "local-hash";

  const runtimeConfig = resolveRuntimeConfig(serializableConfig, process.cwd());

  if (instance) {
    await instance.close().catch(() => undefined);
  }

  instance = createCodeRag(runtimeConfig);
  await instance.index({ docsPath: resolvedDocsPath });
  return instance;
}

export function getCodeRag(): CodeRag | null {
  return instance;
}
