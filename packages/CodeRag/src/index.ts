import type { CodeRagConfig } from "./types.js";
import { CodeRag } from "./service/coderag.js";

export { CodeRag } from "./service/coderag.js";
export { CodeflowCoreGraphProvider, buildGraphSnapshot } from "./adapters/codeflow-core.js";
export { loadCodeRagConfig, loadSerializableConfig, resolveRuntimeConfig } from "./service/config.js";
export { createHttpServer, serveHttpServer } from "./service/http.js";
export { LocalHashEmbeddingProvider } from "./indexer/embedder.js";
export { OnnxEmbeddingProvider } from "./indexer/onnx-embedder.js";
export { isPostCommitHookInstalled, installPostCommitHook } from "./indexer/git-hook.js";
export { LanceVectorStore } from "./store/vector-store.js";
export { createMcpServer, serveStdioMcpServer } from "./mcp/server.js";
export { runSetupWizard } from "./cli/setup-wizard.js";
export * from "./errors/index.js";
export * from "./types.js";

/**
 * Creates a CodeRag service instance for the supplied runtime config.
 */
export const createCodeRag = (config: CodeRagConfig): CodeRag => new CodeRag(config);
