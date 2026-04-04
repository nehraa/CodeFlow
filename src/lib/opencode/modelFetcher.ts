/**
 * OpenCode Model Fetcher
 * Validates API keys and fetches available models from provider APIs
 */

import type { OpencodeProvider } from "./types";

export type ValidationResult = {
  valid: boolean;
  error?: string;
  models?: string[];
};

/**
 * Validate API key and fetch available models for a provider
 */
export async function validateAndFetchModels(
  provider: OpencodeProvider,
  apiKey: string
): Promise<ValidationResult> {
  if (!apiKey || apiKey.length < 10) {
    return { valid: false, error: "API key too short" };
  }

  try {
    switch (provider) {
      case "openai":
        return await fetchOpenAIModels(apiKey);
      case "anthropic":
        return await fetchAnthropicModels(apiKey);
      case "google":
        return await fetchGoogleModels(apiKey);
      case "groq":
        return await fetchGroqModels(apiKey);
      case "cohere":
        return await fetchCohereModels(apiKey);
      case "mistral":
        return await fetchMistralModels(apiKey);
      case "perplexity":
        return await fetchPerplexityModels(apiKey);
      case "openrouter":
        return await fetchOpenRouterModels(apiKey);
      case "azure":
        return { valid: true, models: ["gpt-4", "gpt-3.5-turbo"] };
      case "bedrock":
        return { valid: true, models: ["anthropic.claude-v3-5-sonnet"] };
      case "local":
        return { valid: true, models: ["custom"] };
      default:
        return { valid: false, error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, error: message };
  }
}

/**
 * Fetch OpenAI models
 */
async function fetchOpenAIModels(apiKey: string): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid OpenAI API key" };
      }
      return { valid: false, error: `OpenAI API error: ${response.status}` };
    }

    const data = (await response.json()) as { data: Array<{ id: string }> };
    const models = data.data
      .map((m) => m.id)
      .filter(
        (id) =>
          id.includes("gpt") &&
          !id.includes("vision") &&
          !id.includes("dall-e")
      )
      .slice(0, 20); // Limit to 20 recent models

    if (models.length === 0) {
      return { valid: false, error: "No GPT models found in account" };
    }

    return { valid: true, models };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { valid: false, error: "OpenAI API request timed out" };
    }
    return { valid: false, error: `Failed to fetch OpenAI models` };
  }
}

/**
 * Fetch Anthropic models
 */
async function fetchAnthropicModels(apiKey: string): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      "https://api.anthropic.com/v1/models",
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid Anthropic API key" };
      }
      return { valid: false, error: `Anthropic API error: ${response.status}` };
    }

    const data = (await response.json()) as { data: Array<{ id: string }> };
    const models = data.data.map((m) => m.id);

    if (models.length === 0) {
      return { valid: false, error: "No Claude models found in account" };
    }

    return { valid: true, models };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { valid: false, error: "Anthropic API request timed out" };
    }
    return { valid: false, error: "Failed to fetch Anthropic models" };
  }
}

/**
 * Fetch Google models
 */
async function fetchGoogleModels(apiKey: string): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid Google API key" };
      }
      return { valid: false, error: `Google API error: ${response.status}` };
    }

    const data = (await response.json()) as { models: Array<{ name: string }> };
    const models = data.models
      .map((m) => m.name.replace("models/", ""))
      .filter((id) => id.includes("gemini"));

    if (models.length === 0) {
      return { valid: false, error: "No Gemini models found" };
    }

    return { valid: true, models };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { valid: false, error: "Google API request timed out" };
    }
    return { valid: false, error: "Failed to fetch Google models" };
  }
}

/**
 * Fetch Groq models
 */
async function fetchGroqModels(apiKey: string): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid Groq API key" };
      }
      return { valid: false, error: `Groq API error: ${response.status}` };
    }

    const data = (await response.json()) as { data: Array<{ id: string }> };
    const models = data.data.map((m) => m.id);

    if (models.length === 0) {
      return { valid: false, error: "No Groq models found" };
    }

    return { valid: true, models };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { valid: false, error: "Groq API request timed out" };
    }
    return { valid: false, error: "Failed to fetch Groq models" };
  }
}

/**
 * Fetch Cohere models
 */
async function fetchCohereModels(apiKey: string): Promise<ValidationResult> {
  // Cohere doesn't have a public models list endpoint
  // Return default models and assume key is valid if format is correct
  return {
    valid: true,
    models: [
      "command-r-plus",
      "command-r",
      "command",
      "command-light",
      "command-nightly",
    ],
  };
}

/**
 * Fetch Mistral models
 */
async function fetchMistralModels(apiKey: string): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.mistral.ai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid Mistral API key" };
      }
      return { valid: false, error: `Mistral API error: ${response.status}` };
    }

    const data = (await response.json()) as { data: Array<{ id: string }> };
    const models = data.data.map((m) => m.id);

    if (models.length === 0) {
      return { valid: false, error: "No Mistral models found" };
    }

    return { valid: true, models };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { valid: false, error: "Mistral API request timed out" };
    }
    return { valid: false, error: "Failed to fetch Mistral models" };
  }
}

/**
 * Fetch Perplexity models
 */
async function fetchPerplexityModels(
  apiKey: string
): Promise<ValidationResult> {
  // Perplexity doesn't have a public models list endpoint
  // Return default models and assume key is valid if format is correct
  return {
    valid: true,
    models: [
      "llama-3.1-sonar-large-128k-online",
      "llama-3.1-sonar-small-128k-online",
      "llama-3.1-sonar-large-128k-chat",
      "llama-3.1-sonar-small-128k-chat",
    ],
  };
}

/**
 * Fetch OpenRouter models
 */
async function fetchOpenRouterModels(
  apiKey: string
): Promise<ValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { valid: false, error: `OpenRouter API error: ${response.status}` };
    }

    const data = (await response.json()) as { data: Array<{ id: string }> };
    // Filter for popular models and limit to 30
    const models = data.data
      .map((m) => m.id)
      .filter((id) => !id.includes("deprecated"))
      .slice(0, 30);

    if (models.length === 0) {
      return { valid: false, error: "No OpenRouter models found" };
    }

    return { valid: true, models };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { valid: false, error: "OpenRouter request timed out" };
    }
    return { valid: false, error: "Failed to fetch OpenRouter models" };
  }
}
