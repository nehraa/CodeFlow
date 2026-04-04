/**
 * OpenCode integration types
 */

export type OpencodeProvider = 
  | "anthropic"
  | "openai"
  | "google"
  | "azure"
  | "bedrock"
  | "cohere"
  | "groq"
  | "mistral"
  | "perplexity"
  | "openrouter"
  | "local";

export type OpencodeConfig = {
  provider: OpencodeProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  logLevel?: "debug" | "info" | "warn" | "error";
  mcpServers?: McpServerConfig[];
  skills?: string[];
  hooks?: string[];
};

export type McpServerConfig = {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type OpencodeServerStatus = 
  | "stopped"
  | "starting"
  | "running"
  | "error";

export type OpencodeServerInfo = {
  status: OpencodeServerStatus;
  url?: string;
  error?: string;
  pid?: number;
};

export type AgentType = "build" | "plan" | "general";

export type AgentRequest = {
  type: AgentType;
  message: string;
  context?: {
    files?: string[];
    codeSnippets?: Array<{ path: string; content: string }>;
    previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  };
};

export type AgentResponse = {
  success: boolean;
  response?: string;
  actions?: Array<{
    type: "file_edit" | "file_create" | "file_delete" | "bash_command" | "code_suggestion";
    payload: unknown;
  }>;
  error?: string;
};

export type ProviderModelConfig = {
  provider: OpencodeProvider;
  defaultModel: string;
  apiKeyEnvVar: string;
  apiKeyFormat?: RegExp;
  baseUrlRequired?: boolean;
};

export const PROVIDER_CONFIGS: Record<OpencodeProvider, ProviderModelConfig> = {
  anthropic: {
    provider: "anthropic",
    defaultModel: "claude-sonnet-4.5",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    apiKeyFormat: /^sk-ant-api03-[\w-]+$/,
  },
  openai: {
    provider: "openai",
    defaultModel: "gpt-5.4-mini",
    apiKeyEnvVar: "OPENAI_API_KEY",
    // More specific: OpenAI keys are longer (20+ chars after "sk-")
    apiKeyFormat: /^sk-[a-zA-Z0-9]{20,}$/,
  },
  google: {
    provider: "google",
    defaultModel: "gemini-2.5-flash",
    apiKeyEnvVar: "GOOGLE_API_KEY",
    // Google API keys don't have a consistent prefix; skip auto-detection
  },
  azure: {
    provider: "azure",
    defaultModel: "gpt-4",
    apiKeyEnvVar: "AZURE_OPENAI_API_KEY",
    baseUrlRequired: true,
    // Azure uses base64-encoded tokens; skip auto-detection
  },
  bedrock: {
    provider: "bedrock",
    defaultModel: "anthropic.claude-v3-5-sonnet",
    apiKeyEnvVar: "AWS_ACCESS_KEY_ID",
    // AWS uses AKIA format; risky to detect without full access key
  },
  cohere: {
    provider: "cohere",
    defaultModel: "command-r-plus",
    apiKeyEnvVar: "COHERE_API_KEY",
    // Cohere keys typically start with "co_"
    apiKeyFormat: /^co_[\w-]+$/,
  },
  groq: {
    provider: "groq",
    defaultModel: "llama-3.3-70b-versatile",
    apiKeyEnvVar: "GROQ_API_KEY",
    // Groq keys start with "gsk_"
    apiKeyFormat: /^gsk_[\w-]+$/,
  },
  mistral: {
    provider: "mistral",
    defaultModel: "mistral-large-latest",
    apiKeyEnvVar: "MISTRAL_API_KEY",
    // Mistral keys start with "k_" or are UUIDs; using common pattern
    apiKeyFormat: /^[\w-]{32,}$/,
  },
  perplexity: {
    provider: "perplexity",
    defaultModel: "llama-3.1-sonar-large-128k-online",
    apiKeyEnvVar: "PERPLEXITY_API_KEY",
    // Perplexity keys start with "pplx_"
    apiKeyFormat: /^pplx[-_][\w-]+$/,
  },
  openrouter: {
    provider: "openrouter",
    defaultModel: "anthropic/claude-3.5-sonnet",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    // OpenRouter keys start with "sk-or-"
    apiKeyFormat: /^sk-or-[\w-]+$/,
  },
  local: {
    provider: "local",
    defaultModel: "custom",
    apiKeyEnvVar: "",
    baseUrlRequired: true,
    // Local models don't require API keys
  },
};
