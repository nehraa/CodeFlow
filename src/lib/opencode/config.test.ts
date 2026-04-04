import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  detectProvider,
  buildOpencodeConfig,
  saveConfig,
  loadConfig,
  validateConfig,
} from "./config";

describe("OpenCode Config", () => {
  beforeEach(() => {
    // Create proper storage mocks
    const mockStorage: Record<string, string> = {};
    
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStorage[`local_${key}`] ?? null,
      setItem: (key: string, value: string) => { mockStorage[`local_${key}`] = value; },
      removeItem: (key: string) => { delete mockStorage[`local_${key}`]; },
      clear: () => Object.keys(mockStorage).filter(k => k.startsWith("local_")).forEach(k => delete mockStorage[k]),
      length: 0,
      key: vi.fn(),
    });
    
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => mockStorage[`session_${key}`] ?? null,
      setItem: (key: string, value: string) => { mockStorage[`session_${key}`] = value; },
      removeItem: (key: string) => { delete mockStorage[`session_${key}`]; },
      clear: () => Object.keys(mockStorage).filter(k => k.startsWith("session_")).forEach(k => delete mockStorage[k]),
      length: 0,
      key: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("detectProvider", () => {
    test("detects Anthropic from API key prefix", () => {
      expect(detectProvider("sk-ant-api03-test")).toBe("anthropic");
    });

    test("detects OpenAI from API key prefix", () => {
      expect(detectProvider("sk-test-key")).toBe("openai");
      expect(detectProvider("sk-proj-test")).toBe("openai");
    });

    test("returns null for unknown key format", () => {
      expect(detectProvider("unknown-key")).toBeNull();
    });
  });

  describe("buildOpencodeConfig", () => {
    test("builds config with required fields", () => {
      const config = buildOpencodeConfig("anthropic", "test-key", {});

      expect(config).toBeDefined();
      expect(config.provider).toBe("anthropic");
      expect(config.apiKey).toBe("test-key");
    });

    test("includes model when specified", () => {
      const config = buildOpencodeConfig("anthropic", "test-key", {
        model: "claude-3-sonnet",
      });

      expect(config.model).toBe("claude-3-sonnet");
    });

    test("includes MCP servers when specified", () => {
      const config = buildOpencodeConfig("openai", "test-key", {
        mcpServers: [
          { name: "test-server", command: "npx test" }
        ],
      });

      expect(config.mcpServers).toHaveLength(1);
      expect(config.mcpServers![0].name).toBe("test-server");
    });
  });

  describe("validateConfig", () => {
    test("returns false for missing API key (non-local provider)", () => {
      const result = validateConfig({ provider: "anthropic", apiKey: "" });
      expect(result.valid).toBe(false);
    });

    test("returns true for valid config", () => {
      const result = validateConfig({ provider: "anthropic", apiKey: "sk-ant-api03-valid" });
      expect(result.valid).toBe(true);
    });

    test("accepts local provider without API key but with base URL", () => {
      const result = validateConfig({ provider: "local", apiKey: "", baseUrl: "http://localhost:11434" });
      expect(result.valid).toBe(true);
    });
  });

  describe("saveConfig and loadConfig", () => {
    test("saves and loads config", () => {
      const config = buildOpencodeConfig("anthropic", "test-key", {
        model: "claude-3-sonnet",
      });

      saveConfig(config);
      const loaded = loadConfig();

      expect(loaded).not.toBeNull();
      expect(loaded?.provider).toBe("anthropic");
      expect(loaded?.model).toBe("claude-3-sonnet");
    });
  });
});
