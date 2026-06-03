import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ConfigurationError } from "../errors/index.js";
import { loadCodeRagConfig, loadSerializableConfig } from "../service/config.js";
import { cleanupPaths, createTempDir } from "./helpers.js";

const createdPaths: string[] = [];
const envKeys = [
  "CODERAG_REPO_PATH",
  "CODERAG_STORAGE_ROOT",
  "CODERAG_TOP_K",
  "CODERAG_RERANK_K",
  "CODERAG_MAX_CONTEXT_CHARS",
  "CODERAG_DEFAULT_DEPTH",
  "CODERAG_MAX_DEPTH",
  "CODERAG_LLM_ENABLED",
  "CODERAG_LLM_TRANSPORT",
  "CODERAG_LLM_BASE_URL",
  "CODERAG_LLM_MODEL",
  "CODERAG_LLM_API_KEY",
  "CODERAG_LLM_TIMEOUT_MS",
  "CODERAG_CUSTOM_HTTP_FORMAT",
  "CODERAG_LLM_HEADERS",
  "CODERAG_SERVICE_HOST",
  "CODERAG_SERVICE_PORT",
  "CODERAG_SERVICE_API_KEY",
  "CODERAG_LOCK_TIMEOUT_MS",
  "CODERAG_LOCK_POLL_MS",
  "CODERAG_LOCK_STALE_MS",
  "CODERAG_EMBEDDING_PROVIDER",
  "CODERAG_EMBEDDING_DIMENSIONS",
  "CODERAG_GEMINI_MODEL",
  "CODERAG_EMBEDDING_TIMEOUT_MS",
  "CODERAG_GEMINI_API_KEY",
  "CODERAG_GEMINI_AI_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY"
] as const;

afterEach(async () => {
  await cleanupPaths(createdPaths);
  for (const key of envKeys) {
    delete process.env[key];
  }
});

describe("config loading", () => {
  it("loads defaults when no config file exists", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);

    const config = await loadSerializableConfig(cwd);

    expect(config.repoPath).toBe(cwd);
    expect(config.service.port).toBe(4119);
    expect(config.locking.timeoutMs).toBe(30000);
  });

  it("loads supported overrides from .env when process env is unset", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    await fs.writeFile(
      path.join(cwd, ".env"),
      [
        "CODERAG_TOP_K=9",
        "CODERAG_GEMINI_AI_KEY=dotenv-key",
        "CODERAG_LLM_ENABLED=true",
        "CODERAG_LLM_HEADERS={\"x-dotenv\":\"1\"}"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        embedding: {
          provider: "gemini",
          dimensions: 768,
          geminiModel: "models/test-embedder",
          timeoutMs: 1234
        },
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: {
          enabled: false,
          transport: "openai-compatible",
          baseUrl: "http://127.0.0.1:1234",
          model: "test-model",
          timeoutMs: 1000,
          customHttpFormat: "json",
          headers: {}
        }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);

    expect(config.retrieval.topK).toBe(9);
    expect(config.llm.enabled).toBe(true);
    expect(config.llm.headers["x-dotenv"]).toBe("1");
    expect(config.embeddingProvider?.name).toBe("gemini");
  });

  it("prefers existing process env over .env values", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    await fs.writeFile(path.join(cwd, ".env"), "CODERAG_TOP_K=9\n", "utf8");
    process.env.CODERAG_TOP_K = "7";

    const config = await loadSerializableConfig(cwd);

    expect(config.retrieval.topK).toBe(7);
  });

  it("rejects malformed .env entries", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    await fs.writeFile(path.join(cwd, ".env"), "not-a-valid-env-line\n", "utf8");

    await expect(loadSerializableConfig(cwd)).rejects.toThrow(`Invalid .env entry on line 1. Expected KEY=value.`);
  });

  it("loads config files and environment overrides", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag-data",
        retrieval: { topK: 4, rerankK: 2, maxContextChars: 4096 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 500 },
        service: { host: "127.0.0.1", port: 4120 },
        llm: { enabled: false, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );

    process.env.CODERAG_TOP_K = "8";
    process.env.CODERAG_LLM_HEADERS = JSON.stringify({ "x-test": "1" });
    process.env.CODERAG_SERVICE_PORT = "5000";

    const config = await loadSerializableConfig(cwd);

    expect(config.retrieval.topK).toBe(8);
    expect(config.llm.headers["x-test"]).toBe("1");
    expect(config.service.port).toBe(5000);
  });

  it("supports fallback config filenames and ignores invalid numeric env overrides", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    await fs.writeFile(
      path.join(cwd, ".coderag.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 4, rerankK: 2, maxContextChars: 2048 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: { enabled: false, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );
    process.env.CODERAG_TOP_K = "not-a-number";

    const config = await loadSerializableConfig(cwd);
    expect(config.retrieval.topK).toBe(4);
  });

  it("supports explicit config paths and false boolean overrides", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    const configPath = path.join(cwd, "custom.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 4, rerankK: 2, maxContextChars: 2048 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: {
          enabled: true,
          transport: "openai-compatible",
          baseUrl: "http://127.0.0.1:1234",
          model: "model",
          timeoutMs: 1000,
          customHttpFormat: "json",
          headers: {}
        }
      }),
      "utf8"
    );
    process.env.CODERAG_LLM_ENABLED = "false";

    const config = await loadSerializableConfig(cwd, "custom.json");
    expect(config.llm.enabled).toBe(false);
  });

  it("rejects invalid header overrides", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    process.env.CODERAG_LLM_HEADERS = "[]";

    await expect(loadSerializableConfig(cwd)).rejects.toThrow(ConfigurationError);
  });

  it("validates rerank and traversal bounds at runtime", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 1, rerankK: 2, maxContextChars: 1024 },
        traversal: { defaultDepth: 5, maxDepth: 4 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: { enabled: false, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );

    await expect(loadCodeRagConfig(cwd)).rejects.toThrow(ConfigurationError);
  });

  it("validates traversal bounds when rerank settings are otherwise valid", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 5, maxDepth: 4 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: { enabled: false, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );

    await expect(loadCodeRagConfig(cwd)).rejects.toThrow("traversal.defaultDepth");
  });

  it("creates runtime transports when llm config is enabled", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: {
          enabled: true,
          transport: "custom-http",
          baseUrl: "http://127.0.0.1:1234",
          model: "test-model",
          timeoutMs: 1000,
          customHttpFormat: "json",
          headers: {}
        }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);
    expect(config.llmTransport?.kind).toBe("custom-http");
  });

  it("creates the OpenAI-compatible runtime transport when requested", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: {
          enabled: true,
          transport: "openai-compatible",
          baseUrl: "http://127.0.0.1:1234",
          model: "test-model",
          timeoutMs: 1000,
          customHttpFormat: "json",
          headers: {}
        }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);
    expect(config.llmTransport?.kind).toBe("openai-compatible");
  });

  it("creates the Gemini embedding provider when configured", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    process.env.CODERAG_GEMINI_API_KEY = "test-key";
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        embedding: {
          provider: "gemini",
          dimensions: 768,
          geminiModel: "models/test-embedder",
          timeoutMs: 1234
        },
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: { enabled: false, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);
    expect(config.embeddingProvider?.name).toBe("gemini");
    expect(config.embeddingProvider?.model).toBe("models/test-embedder");
    expect(config.embeddingProvider?.dimensions).toBe(768);
  });

  it("accepts the Gemini AI_KEY env alias when building the runtime provider", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    process.env.CODERAG_GEMINI_AI_KEY = "alias-key";
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        embedding: {
          provider: "gemini",
          dimensions: 768,
          geminiModel: "models/test-embedder",
          timeoutMs: 1234
        },
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: { enabled: false, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);
    expect(config.embeddingProvider?.name).toBe("gemini");
    expect(config.embeddingProvider?.model).toBe("models/test-embedder");
    expect(config.embeddingProvider?.dimensions).toBe(768);
  });

  it("auto-detects OpenRouter transport from OPENROUTER_API_KEY when LLM is enabled without baseUrl", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: { enabled: true, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);
    expect(config.llmTransport?.kind).toBe("openai-compatible");
    expect(config.llm.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(config.llm.apiKey).toBe("sk-or-test-key");
  });

  it("auto-detects OpenAI transport from OPENAI_API_KEY when LLM is enabled without baseUrl", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    process.env.OPENAI_API_KEY = "sk-test-key";
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: { enabled: true, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);
    expect(config.llmTransport?.kind).toBe("openai-compatible");
    expect(config.llm.baseUrl).toBe("https://api.openai.com/v1");
    expect(config.llm.apiKey).toBe("sk-test-key");
  });

  it("auto-detects Anthropic transport from ANTHROPIC_API_KEY when LLM is enabled without baseUrl", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: { enabled: true, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);
    expect(config.llmTransport?.kind).toBe("custom-http");
    expect(config.llm.baseUrl).toBe("https://api.anthropic.com");
    expect(config.llm.apiKey).toBe("sk-ant-test-key");
  });

  it("prefers explicit baseUrl over auto-detection", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    process.env.OPENAI_API_KEY = "sk-test-key";
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: {
          enabled: true,
          transport: "openai-compatible",
          baseUrl: "http://custom-api.example.com/v1",
          model: "custom-model",
          timeoutMs: 1000,
          customHttpFormat: "json",
          headers: {}
        }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);
    expect(config.llmTransport?.kind).toBe("openai-compatible");
    expect(config.llm.baseUrl).toBe("http://custom-api.example.com/v1");
  });

  it("does not create transport when LLM is disabled", async () => {
    const cwd = await createTempDir("coderag-config-");
    createdPaths.push(cwd);
    process.env.OPENAI_API_KEY = "sk-test-key";
    await fs.writeFile(
      path.join(cwd, "coderag.config.json"),
      JSON.stringify({
        repoPath: ".",
        storageRoot: ".coderag",
        retrieval: { topK: 2, rerankK: 1, maxContextChars: 1024 },
        traversal: { defaultDepth: 1, maxDepth: 2 },
        locking: { timeoutMs: 100, pollMs: 10, staleMs: 100 },
        service: { host: "127.0.0.1", port: 4119 },
        llm: { enabled: false, transport: "openai-compatible", timeoutMs: 1000, customHttpFormat: "json", headers: {} }
      }),
      "utf8"
    );

    const config = await loadCodeRagConfig(cwd);
    expect(config.llmTransport).toBeUndefined();
  });
});
