/**
 * OpenCode configuration helpers
 */

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
 * Convert OpencodeConfig to environment variables for OpenCode CLI
 */
export function configToEnv(config: OpencodeConfig): Record<string, string> {
  const env: Record<string, string> = {};
  const providerConfig = PROVIDER_CONFIGS[config.provider];

  if (config.apiKey && providerConfig.apiKeyEnvVar) {
    env[providerConfig.apiKeyEnvVar] = config.apiKey;
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
