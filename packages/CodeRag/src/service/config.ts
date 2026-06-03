import path from "node:path";

import type { CodeRagConfig, SerializableCodeRagConfig } from "../types.js";
import { CodeflowCoreGraphProvider } from "../adapters/codeflow-core.js";
import { ConfigurationError } from "../errors/index.js";
import { GeminiEmbeddingProvider, resolveGeminiApiKey } from "../indexer/gemini-embedder.js";
import { LocalHashEmbeddingProvider } from "../indexer/embedder.js";
import { OnnxEmbeddingProvider } from "../indexer/onnx-embedder.js";
import { CustomHttpTransport, OpenAiCompatibleTransport } from "../llm/transports.js";
import { LanceVectorStore } from "../store/vector-store.js";
import { fileExists, readJson, readTextFile, resolveWithin } from "../utils/filesystem.js";
import { createConsoleLogger } from "../utils/logger.js";
import {
  llmConfigSchema,
  lockingConfigSchema,
  serializableConfigSchema,
  serviceConfigSchema
} from "../types.js";

const CONFIG_FILES = ["coderag.config.json", ".coderag.json"];
const DOTENV_FILE = ".env";

const parseDotEnvValue = (rawValue: string): string => {
  const value = rawValue.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    const unquoted = value.slice(1, -1);
    if (value.startsWith("\"")) {
      return unquoted
        .replaceAll("\\n", "\n")
        .replaceAll("\\r", "\r")
        .replaceAll("\\t", "\t")
        .replaceAll('\\"', "\"")
        .replaceAll("\\\\", "\\");
    }

    return unquoted;
  }

  return value;
};

const parseDotEnv = (content: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const [index, originalLine] of lines.entries()) {
    const line = originalLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const equalsIndex = normalizedLine.indexOf("=");
    if (equalsIndex <= 0) {
      throw new ConfigurationError(`Invalid ${DOTENV_FILE} entry on line ${index + 1}. Expected KEY=value.`);
    }

    const key = normalizedLine.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new ConfigurationError(`Invalid ${DOTENV_FILE} key "${key}" on line ${index + 1}.`);
    }

    parsed[key] = parseDotEnvValue(normalizedLine.slice(equalsIndex + 1));
  }

  return parsed;
};

const loadDotEnv = async (cwd: string): Promise<void> => {
  const envPath = path.join(cwd, DOTENV_FILE);
  if (!(await fileExists(envPath))) {
    return;
  }

  const entries = parseDotEnv(await readTextFile(envPath));
  for (const [key, value] of Object.entries(entries)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return value === "1" || value.toLowerCase() === "true";
};

const parseNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseJsonRecord = (value: string | undefined): Record<string, string> | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigurationError("CODERAG_LLM_HEADERS must be a JSON object.");
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, entryValue]) => [key, String(entryValue)])
  );
};

const resolveConfigPath = async (cwd: string, configPath?: string): Promise<string | undefined> => {
  if (configPath) {
    return path.resolve(cwd, configPath);
  }

  const existingConfig = await Promise.all(
    CONFIG_FILES.map(async (candidate) => (await fileExists(path.join(cwd, candidate)) ? candidate : null))
  );
  const matchedConfig = existingConfig.find(Boolean);
  return matchedConfig ? path.resolve(cwd, matchedConfig) : undefined;
};

/**
 * Loads the serializable CodeRag config from disk and environment overrides.
 */
export const loadSerializableConfig = async (cwd: string, configPath?: string): Promise<SerializableCodeRagConfig> => {
  await loadDotEnv(cwd);
  const resolvedConfigPath = await resolveConfigPath(cwd, configPath);
  const baseConfig = resolvedConfigPath
    ? serializableConfigSchema.parse(await readJson<SerializableCodeRagConfig>(resolvedConfigPath))
    : serializableConfigSchema.parse({ repoPath: cwd });
  const envHeaders = parseJsonRecord(process.env.CODERAG_LLM_HEADERS);

  return serializableConfigSchema.parse({
    ...baseConfig,
    repoPath: process.env.CODERAG_REPO_PATH ?? baseConfig.repoPath,
    storageRoot: process.env.CODERAG_STORAGE_ROOT ?? baseConfig.storageRoot,
    embedding: {
      ...baseConfig.embedding,
      provider: (process.env.CODERAG_EMBEDDING_PROVIDER as typeof baseConfig.embedding.provider) ?? baseConfig.embedding.provider,
      dimensions: parseNumber(process.env.CODERAG_EMBEDDING_DIMENSIONS) ?? baseConfig.embedding.dimensions,
      geminiModel: process.env.CODERAG_GEMINI_MODEL ?? baseConfig.embedding.geminiModel,
      timeoutMs: parseNumber(process.env.CODERAG_EMBEDDING_TIMEOUT_MS) ?? baseConfig.embedding.timeoutMs,
      onnxModelDir: process.env.CODERAG_ONNX_MODEL_DIR ?? baseConfig.embedding.onnxModelDir
    },
    retrieval: {
      ...baseConfig.retrieval,
      topK: parseNumber(process.env.CODERAG_TOP_K) ?? baseConfig.retrieval.topK,
      rerankK: parseNumber(process.env.CODERAG_RERANK_K) ?? baseConfig.retrieval.rerankK,
      maxContextChars: parseNumber(process.env.CODERAG_MAX_CONTEXT_CHARS) ?? baseConfig.retrieval.maxContextChars,
      primaryDocLimit: parseNumber(process.env.CODERAG_PRIMARY_DOC_LIMIT) ?? baseConfig.retrieval.primaryDocLimit,
      primaryFileLimit: parseNumber(process.env.CODERAG_PRIMARY_FILE_LIMIT) ?? baseConfig.retrieval.primaryFileLimit,
      relatedDocLimit: parseNumber(process.env.CODERAG_RELATED_DOC_LIMIT) ?? baseConfig.retrieval.relatedDocLimit,
      relatedFileLimit: parseNumber(process.env.CODERAG_RELATED_FILE_LIMIT) ?? baseConfig.retrieval.relatedFileLimit
    },
    multiHop: {
      ...baseConfig.multiHop,
      enabled: parseBoolean(process.env.CODERAG_MULTI_HOP_ENABLED) ?? baseConfig.multiHop.enabled,
      minQuestionLength: parseNumber(process.env.CODERAG_MULTI_HOP_MIN_QUESTION_LENGTH) ?? baseConfig.multiHop.minQuestionLength,
      maxSubQuestions: parseNumber(process.env.CODERAG_MULTI_HOP_MAX_QUESTIONS) ?? baseConfig.multiHop.maxSubQuestions,
      expansionDepth: parseNumber(process.env.CODERAG_MULTI_HOP_EXPANSION_DEPTH) ?? baseConfig.multiHop.expansionDepth
    },
    traversal: {
      ...baseConfig.traversal,
      defaultDepth: parseNumber(process.env.CODERAG_DEFAULT_DEPTH) ?? baseConfig.traversal.defaultDepth,
      maxDepth: parseNumber(process.env.CODERAG_MAX_DEPTH) ?? baseConfig.traversal.maxDepth
    },
    locking: lockingConfigSchema.parse({
      ...baseConfig.locking,
      timeoutMs: parseNumber(process.env.CODERAG_LOCK_TIMEOUT_MS) ?? baseConfig.locking.timeoutMs,
      pollMs: parseNumber(process.env.CODERAG_LOCK_POLL_MS) ?? baseConfig.locking.pollMs,
      staleMs: parseNumber(process.env.CODERAG_LOCK_STALE_MS) ?? baseConfig.locking.staleMs
    }),
    service: serviceConfigSchema.parse({
      ...baseConfig.service,
      host: process.env.CODERAG_SERVICE_HOST ?? baseConfig.service.host,
      port: parseNumber(process.env.CODERAG_SERVICE_PORT) ?? baseConfig.service.port,
      apiKey: process.env.CODERAG_SERVICE_API_KEY ?? baseConfig.service.apiKey
    }),
    llm: llmConfigSchema.parse({
      ...baseConfig.llm,
      enabled: parseBoolean(process.env.CODERAG_LLM_ENABLED) ?? baseConfig.llm.enabled,
      transport: process.env.CODERAG_LLM_TRANSPORT ?? baseConfig.llm.transport,
      baseUrl: process.env.CODERAG_LLM_BASE_URL ?? baseConfig.llm.baseUrl,
      model: process.env.CODERAG_LLM_MODEL ?? baseConfig.llm.model,
      apiKey: process.env.CODERAG_LLM_API_KEY ?? baseConfig.llm.apiKey,
      timeoutMs: parseNumber(process.env.CODERAG_LLM_TIMEOUT_MS) ?? baseConfig.llm.timeoutMs,
      customHttpFormat: process.env.CODERAG_CUSTOM_HTTP_FORMAT ?? baseConfig.llm.customHttpFormat,
      headers: envHeaders ?? baseConfig.llm.headers
    })
  });
};

/**
 * Resolves the runtime dependencies needed to execute CodeRag.
 */
export const resolveRuntimeConfig = (config: SerializableCodeRagConfig, cwd: string): CodeRagConfig => {
  const repoPath = resolveWithin(cwd, config.repoPath);
  const storageRoot = resolveWithin(repoPath, config.storageRoot);
  const graphProvider = new CodeflowCoreGraphProvider();

  // Provide defaults when embedding config is missing (backward compatibility)
  const embeddingConfig = config.embedding ?? {
    provider: "local-hash" as const,
    dimensions: 256,
    geminiModel: "models/gemini-embedding-2",
    timeoutMs: 30000
  };

  const embeddingProvider =
    embeddingConfig.provider === "gemini"
      ? new GeminiEmbeddingProvider({
          apiKey: resolveGeminiApiKey(),
          model: embeddingConfig.geminiModel,
          timeoutMs: embeddingConfig.timeoutMs
        })
      : embeddingConfig.provider === "onnx"
        ? new OnnxEmbeddingProvider({
            modelDir: embeddingConfig.onnxModelDir,
            logger: undefined // logger not yet available at config resolution time
          })
        : new LocalHashEmbeddingProvider(embeddingConfig.dimensions);
  const vectorStore = new LanceVectorStore(storageRoot);

  // Auto-detect LLM provider from environment when LLM is enabled but no baseUrl is set
  const llmConfig = { ...config.llm };
  if (llmConfig.enabled && !llmConfig.baseUrl) {
    if (process.env.OPENROUTER_API_KEY) {
      llmConfig.baseUrl = "https://openrouter.ai/api/v1";
      llmConfig.apiKey = process.env.OPENROUTER_API_KEY;
      llmConfig.transport = "openai-compatible";
    } else if (process.env.OPENAI_API_KEY) {
      llmConfig.baseUrl = "https://api.openai.com/v1";
      llmConfig.apiKey = process.env.OPENAI_API_KEY;
      llmConfig.transport = "openai-compatible";
    } else if (process.env.ANTHROPIC_API_KEY) {
      llmConfig.baseUrl = "https://api.anthropic.com";
      llmConfig.apiKey = process.env.ANTHROPIC_API_KEY;
      llmConfig.transport = "custom-http";
      llmConfig.customHttpFormat = "json";
    }
  }

  const llmTransport =
    llmConfig.enabled && llmConfig.baseUrl
      ? llmConfig.transport === "custom-http"
        ? new CustomHttpTransport(llmConfig)
        : new OpenAiCompatibleTransport(llmConfig)
      : undefined;

  return {
    ...config,
    repoPath,
    storageRoot,
    logger: createConsoleLogger(),
    graphProvider,
    embeddingProvider,
    vectorStore,
    llmTransport,
    llm: llmConfig
  };
};

/**
 * Loads and validates the full runtime config for the current working directory.
 */
export const loadCodeRagConfig = async (cwd: string, configPath?: string): Promise<CodeRagConfig> => {
  const serializableConfig = await loadSerializableConfig(cwd, configPath);
  const runtimeConfig = resolveRuntimeConfig(serializableConfig, cwd);
  const resolvedConfigPath = configPath ? path.resolve(cwd, configPath) : undefined;

  if (runtimeConfig.retrieval.rerankK > runtimeConfig.retrieval.topK) {
    throw new ConfigurationError("retrieval.rerankK must be less than or equal to retrieval.topK.");
  }

  if (runtimeConfig.traversal.defaultDepth > runtimeConfig.traversal.maxDepth) {
    throw new ConfigurationError("traversal.defaultDepth must be less than or equal to traversal.maxDepth.");
  }

  if (runtimeConfig.multiHop.expansionDepth > runtimeConfig.traversal.maxDepth) {
    throw new ConfigurationError("multiHop.expansionDepth must be less than or equal to traversal.maxDepth.");
  }

  return {
    ...runtimeConfig,
    configPath: resolvedConfigPath
  };
};
