import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import type { Logger, SerializableCodeRagConfig } from "../types.js";
import { fileExists, writeJson } from "../utils/filesystem.js";
import { installPostCommitHook } from "../indexer/git-hook.js";

const CONFIG_FILES = ["coderag.config.json", ".coderag.json"];

const ask = (rl: readline.Interface, question: string, defaultValue?: string): Promise<string> => {
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || "");
    });
  });
};

const select = async (rl: readline.Interface, question: string, options: string[]): Promise<string> => {
  console.log(question);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const answer = await ask(rl, "Choose (number)");
    const index = Number(answer) - 1;
    if (index >= 0 && index < options.length) {
      return options[index] as string;
    }

    console.log(`  Please enter a number between 1 and ${options.length}.`);
  }
};

const detectExistingConfig = async (cwd: string): Promise<SerializableCodeRagConfig | null> => {
  for (const candidate of CONFIG_FILES) {
    const configPath = path.join(cwd, candidate);
    if (await fileExists(configPath)) {
      const raw = await fs.readFile(configPath, "utf8");
      return JSON.parse(raw) as SerializableCodeRagConfig;
    }
  }

  return null;
};

export const runSetupWizard = async (cwd: string, logger?: Logger): Promise<void> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n⚙️  CodeRag Interactive Setup\n");

  const existingConfig = await detectExistingConfig(cwd);

  // Embedding provider selection
  const embeddingProvider = await select(rl, "Select embedding provider:", [
    "local-hash (free, offline, fast but low quality)",
    "onnx (local neural embeddings via Xenova/gte-small, requires download)",
    "gemini (cloud, best quality, requires API key)"
  ]);

  const providerMap: Record<string, "local-hash" | "onnx" | "gemini"> = {
    "local-hash (free, offline, fast but low quality)": "local-hash",
    "onnx (local neural embeddings via Xenova/gte-small, requires download)": "onnx",
    "gemini (cloud, best quality, requires API key)": "gemini"
  };
  const embeddingProviderKind = providerMap[embeddingProvider] ?? "local-hash";

  let geminiModel = "models/gemini-embedding-2";
  let geminiApiKey = "";
  let onnxModelDir = ".coderag-models/models";

  if (embeddingProviderKind === "gemini") {
    const existingKey = process.env.CODERAG_GEMINI_API_KEY ?? process.env.CODERAG_GEMINI_AI_KEY;
    if (existingKey) {
      geminiApiKey = await ask(rl, "Enter Gemini API key (leave blank to keep existing)", "");
      if (!geminiApiKey) geminiApiKey = existingKey;
    } else {
      geminiApiKey = await ask(rl, "Enter Gemini API key");
    }
    geminiModel = await ask(rl, "Enter Gemini model", geminiModel);
  }

  if (embeddingProviderKind === "onnx") {
    onnxModelDir = await ask(rl, "ONNX model directory (relative to CWD)", onnxModelDir);
  }

  // LLM configuration
  const llmAnswer = await select(rl, "Enable LLM-powered answers? (requires API key):", [
    "No (context-only mode)",
    "Yes — OpenRouter",
    "Yes — OpenAI",
    "Yes — Anthropic",
    "Yes — Custom endpoint"
  ]);

  let llmEnabled = false;
  let llmBaseUrl = "";
  let llmApiKey = "";
  let llmModel = "";
  let llmTransport: "openai-compatible" | "custom-http" = "openai-compatible";
  let customHttpFormat = "json";

  if (llmAnswer !== "No (context-only mode)") {
    llmEnabled = true;

    if (llmAnswer === "Yes — OpenRouter") {
      llmTransport = "openai-compatible";
      llmBaseUrl = "https://openrouter.ai/api/v1";
      const existingKey = process.env.OPENROUTER_API_KEY;
      if (existingKey) {
        llmApiKey = await ask(rl, "Enter OpenRouter API key (leave blank to keep existing)", "");
        if (!llmApiKey) llmApiKey = existingKey;
      } else {
        llmApiKey = await ask(rl, "Enter OpenRouter API key");
      }
      llmModel = await ask(rl, "Enter model name (e.g. anthropic/claude-sonnet-4-20250514)");
    } else if (llmAnswer === "Yes — OpenAI") {
      llmTransport = "openai-compatible";
      llmBaseUrl = "https://api.openai.com/v1";
      const existingKey = process.env.OPENAI_API_KEY;
      if (existingKey) {
        llmApiKey = await ask(rl, "Enter OpenAI API key (leave blank to keep existing)", "");
        if (!llmApiKey) llmApiKey = existingKey;
      } else {
        llmApiKey = await ask(rl, "Enter OpenAI API key");
      }
      llmModel = await ask(rl, "Enter model name (e.g. gpt-4o-mini)", "gpt-4o-mini");
    } else if (llmAnswer === "Yes — Anthropic") {
      llmTransport = "custom-http";
      llmBaseUrl = "https://api.anthropic.com";
      const existingKey = process.env.ANTHROPIC_API_KEY;
      if (existingKey) {
        llmApiKey = await ask(rl, "Enter Anthropic API key (leave blank to keep existing)", "");
        if (!llmApiKey) llmApiKey = existingKey;
      } else {
        llmApiKey = await ask(rl, "Enter Anthropic API key");
      }
      llmModel = await ask(rl, "Enter model name (e.g. claude-sonnet-4-20250514)", "claude-sonnet-4-20250514");
      customHttpFormat = await ask(rl, "Response format", "json");
    } else if (llmAnswer === "Yes — Custom endpoint") {
      llmTransport = await select(rl, "Transport type:", ["openai-compatible", "custom-http"]) as "openai-compatible" | "custom-http";
      llmBaseUrl = await ask(rl, "Enter base URL");
      llmApiKey = await ask(rl, "Enter API key");
      llmModel = await ask(rl, "Enter model name");
      if (llmTransport === "custom-http") {
        customHttpFormat = await ask(rl, "Response format (json/sse/ndjson)", "json");
      }
    }
  }

  // Storage and repo path
  const repoPath = await ask(rl, "Repository path (absolute or relative to CWD)", cwd);
  const storageRoot = await ask(rl, "Storage root directory (for index/cache)", ".coderag");

  // Build the config
  const dimensions = embeddingProviderKind === "gemini" ? 768 : embeddingProviderKind === "onnx" ? 384 : 256;

  const config: SerializableCodeRagConfig = {
    repoPath,
    storageRoot,
    embedding: {
      provider: embeddingProviderKind,
      dimensions,
      geminiModel,
      timeoutMs: 30000,
      onnxModelDir
    },
    retrieval: {
      topK: 6,
      rerankK: 3,
      maxContextChars: 16000
    },
    multiHop: {
      enabled: false,
      minQuestionLength: 25,
      maxSubQuestions: 5,
      expansionDepth: 1
    },
    traversal: {
      defaultDepth: 1,
      maxDepth: 3
    },
    locking: {
      timeoutMs: 30000,
      pollMs: 150,
      staleMs: 300000
    },
    service: {
      host: "127.0.0.1",
      port: 4119
    },
    llm: {
      enabled: llmEnabled,
      transport: llmTransport,
      baseUrl: llmEnabled ? llmBaseUrl : undefined,
      model: llmEnabled ? llmModel : undefined,
      apiKey: llmEnabled ? llmApiKey : undefined,
      timeoutMs: 45000,
      customHttpFormat: customHttpFormat as "json" | "ndjson" | "sse",
      headers: {}
    }
  };

  // Write config file
  const configPath = path.join(cwd, "coderag.config.json");
  await writeJson(configPath, config);
  console.log(`\n✅ Config written to ${configPath}`);

  // Write .env file with API keys if provided
  if (geminiApiKey || llmApiKey) {
    const envLines: string[] = [
      "# CodeRag Environment Configuration",
      "# Generated by coderag setup",
      ""
    ];

    if (geminiApiKey) {
      envLines.push(`CODERAG_GEMINI_API_KEY=${geminiApiKey}`);
    }

    if (llmApiKey) {
      if (llmAnswer === "Yes — OpenRouter") {
        envLines.push(`OPENROUTER_API_KEY=${llmApiKey}`);
      } else if (llmAnswer === "Yes — OpenAI") {
        envLines.push(`OPENAI_API_KEY=${llmApiKey}`);
      } else if (llmAnswer === "Yes — Anthropic") {
        envLines.push(`ANTHROPIC_API_KEY=${llmApiKey}`);
      }
    }

    envLines.push("");
    const envPath = path.join(cwd, ".env");
    await fs.writeFile(envPath, envLines.join("\n"), {
      encoding: "utf8",
      mode: 0o600 // Owner read/write only — protect API keys from other users
    });
    console.log(`✅ API keys written to ${envPath}`);
  }

  // Install git hook
  const resolvedRepoPath = path.resolve(cwd, repoPath);
  await installPostCommitHook(resolvedRepoPath, configPath, logger);
  console.log("✅ Git post-commit hook installed.");

  console.log("\n🎉 Setup complete! Run `coderag index` to build your first index.");

  rl.close();
};
