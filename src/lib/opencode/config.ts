/**
 * OpenCode configuration helpers
 */

import { writeFileSync, mkdtempSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { OpencodeConfig, OpencodeProvider } from "./types";
import { PROVIDER_CONFIGS } from "./types";

const OPENCODE_CONFIG_KEY = "codeflow_opencode_config";

/**
 * Detect provider from API key format
 */
export function detectProvider(apiKey: string): OpencodeProvider | null {
  for (const [provider, config] of Object.entries(PROVIDER_CONFIGS)) {
    if (config.apiKeyFormat && config.apiKeyFormat.test(apiKey)) {
      return provider as OpencodeProvider;
    }
  }
  return null;
}

/**
 * Build OpenCode config object from settings
 */
export function buildOpencodeConfig(
  provider: OpencodeProvider,
  apiKey: string,
  options: {
    model?: string;
    baseUrl?: string;
    logLevel?: OpencodeConfig["logLevel"];
    mcpServers?: OpencodeConfig["mcpServers"];
    skills?: string[];
    hooks?: string[];
  } = {}
): OpencodeConfig {
  const providerConfig = PROVIDER_CONFIGS[provider];
  
  return {
    provider,
    apiKey,
    model: options.model || providerConfig.defaultModel,
    baseUrl: options.baseUrl,
    logLevel: options.logLevel || "info",
    mcpServers: options.mcpServers || [],
    skills: options.skills || [],
    hooks: options.hooks || [],
  };
}

/**
 * Convert OpencodeConfig to environment variables for OpenCode CLI.
 *
 * SECURITY: The API key is NEVER placed directly in the environment.
 * Environment variables are readable via `/proc/<pid>/environ` on Linux
 * by any local user, which would expose the key to local privilege
 * escalation. Instead, the key is written to a temp file with mode
 * 0600 (readable/writable only by the owner) and the file path is
 * passed as the env var value. The child process is expected to read
 * the key from the file.
 */
export function configToEnv(config: OpencodeConfig): Record<string, string> {
  const env: Record<string, string> = {};
  const providerConfig = PROVIDER_CONFIGS[config.provider];

  if (config.apiKey && providerConfig.apiKeyEnvVar) {
    // Write the API key to a unique temp file with restrictive permissions.
    // Using mkdtempSync guarantees an unguessable, exclusive directory name,
    // avoiding symlink attacks in the shared /tmp directory.
    const dir = mkdtempSync(join(tmpdir(), "codeflow-opencode-"));
    const keyFile = join(dir, "api_key");
    writeFileSync(keyFile, config.apiKey, { mode: 0o600 });
    // Belt-and-suspenders: explicitly chmod in case the umask interfered
    // with the mode option (writeFileSync's mode is masked by process.umask).
    chmodSync(keyFile, 0o600);
    env[providerConfig.apiKeyEnvVar] = keyFile;
  }

  if (config.baseUrl) {
    env.OPENCODE_BASE_URL = config.baseUrl;
  }

  if (config.model) {
    env.OPENCODE_MODEL = config.model;
  }

  return env;
}

/**
 * Save OpenCode config to localStorage
 */
export function saveConfig(config: OpencodeConfig): void {
  if (typeof window === "undefined") return;
  
  // Don't store API key in localStorage - only in session
  const sanitized = { ...config, apiKey: undefined };
  localStorage.setItem(OPENCODE_CONFIG_KEY, JSON.stringify(sanitized));
  
  // Store API key in sessionStorage only
  if (config.apiKey) {
    sessionStorage.setItem("codeflow_opencode_api_key", config.apiKey);
  }
}

/**
 * Load OpenCode config from localStorage
 */
export function loadConfig(): OpencodeConfig | null {
  if (typeof window === "undefined") return null;
  
  const stored = localStorage.getItem(OPENCODE_CONFIG_KEY);
  if (!stored) return null;
  
  try {
    const config = JSON.parse(stored) as OpencodeConfig;
    
    // Restore API key from sessionStorage if available
    const apiKey = sessionStorage.getItem("codeflow_opencode_api_key");
    if (apiKey) {
      config.apiKey = apiKey;
    }
    
    return config;
  } catch {
    return null;
  }
}

/**
 * Clear stored config
 */
export function clearConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OPENCODE_CONFIG_KEY);
  sessionStorage.removeItem("codeflow_opencode_api_key");
}

/**
 * Validate config
 */
export function validateConfig(config: OpencodeConfig): { valid: boolean; error?: string } {
  const providerConfig = PROVIDER_CONFIGS[config.provider];
  
  if (!config.apiKey && config.provider !== "local") {
    return { valid: false, error: "API key is required" };
  }
  
  if (providerConfig.baseUrlRequired && !config.baseUrl) {
    return { valid: false, error: "Base URL is required for this provider" };
  }
  
  if (config.apiKey && providerConfig.apiKeyFormat && !providerConfig.apiKeyFormat.test(config.apiKey)) {
    return { valid: false, error: "Invalid API key format" };
  }
  
  return { valid: true };
}
