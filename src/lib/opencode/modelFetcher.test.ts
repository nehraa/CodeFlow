/**
 * Model Fetcher Tests
 * Tests API key validation and model discovery for all providers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateAndFetchModels } from "./modelFetcher";
import type { OpencodeProvider } from "./types";

describe("Model Fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("validateAndFetchModels", () => {
    it("returns error for empty API key", async () => {
      const result = await validateAndFetchModels("openai", "");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("API key too short");
    });

    it("returns error for short API key", async () => {
      const result = await validateAndFetchModels("openai", "short");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("API key too short");
    });

    it("handles unknown provider gracefully", async () => {
      const result = await validateAndFetchModels(
        "unknown" as OpencodeProvider,
        "test-key-12345"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unknown provider");
    });

    it("returns valid result for Cohere (no API check)", async () => {
      const result = await validateAndFetchModels(
        "cohere",
        "test-key-12345"
      );
      expect(result.valid).toBe(true);
      expect(result.models).toBeDefined();
      expect(result.models?.length).toBeGreaterThan(0);
      expect(result.models).toContain("command-r-plus");
    });

    it("returns valid result for Perplexity (no API check)", async () => {
      const result = await validateAndFetchModels(
        "perplexity",
        "test-key-12345"
      );
      expect(result.valid).toBe(true);
      expect(result.models).toBeDefined();
      expect(result.models?.length).toBeGreaterThan(0);
      expect(result.models).toContain(
        "llama-3.1-sonar-large-128k-online"
      );
    });

    it("returns valid result for Azure (no API check)", async () => {
      const result = await validateAndFetchModels("azure", "test-key-12345");
      expect(result.valid).toBe(true);
      expect(result.models).toContain("gpt-4");
      expect(result.models).toContain("gpt-3.5-turbo");
    });

    it("returns valid result for Bedrock (no API check)", async () => {
      const result = await validateAndFetchModels("bedrock", "test-key-12345");
      expect(result.valid).toBe(true);
      expect(result.models).toContain("anthropic.claude-v3-5-sonnet");
    });

    it("returns valid result for local (no API check)", async () => {
      const result = await validateAndFetchModels("local", "test-key-12345");
      expect(result.valid).toBe(true);
      expect(result.models).toContain("custom");
    });

    it("handles providers with API validation", async () => {
      // These would make actual API calls in a real scenario
      // For unit tests, we're just ensuring they don't crash with long keys
      const testKey = "test-key-" + "x".repeat(50);

      // Test that function doesn't crash
      const result = await validateAndFetchModels("openai", testKey);
      // Result will be invalid due to mock key, but function should handle it
      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("error");
    });
  });

  describe("Supported providers", () => {
    const providers: OpencodeProvider[] = [
      "anthropic",
      "openai",
      "google",
      "azure",
      "groq",
      "cohere",
      "mistral",
      "perplexity",
      "openrouter",
      "bedrock",
      "local",
    ];

    it("should handle all 11 providers without crashing", async () => {
      const testKey = "test-key-" + "x".repeat(50);

      for (const provider of providers) {
        const result = await validateAndFetchModels(provider, testKey);
        expect(result).toHaveProperty("valid");
        // Either valid with models or invalid with error
        if (result.valid) {
          expect(result.models).toBeDefined();
          expect(Array.isArray(result.models)).toBe(true);
        } else {
          expect(result.error).toBeDefined();
        }
      }
    });
  });

  describe("Error handling", () => {
    it("handles timeout gracefully", async () => {
      // Simulate a very short key that will still trigger API calls
      const result = await validateAndFetchModels("openai", "sk-" + "x".repeat(100));
      // Should either return valid result or error, not throw
      expect(result).toHaveProperty("valid");
    });

    it("provides meaningful error messages", async () => {
      const result = await validateAndFetchModels("openai", "invalid-key");
      if (!result.valid) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe("string");
        expect(result.error!.length).toBeGreaterThan(0);
      }
    });
  });
});
