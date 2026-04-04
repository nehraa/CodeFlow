import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isOpencodeAvailable,
  getOpencodeUrl,
  getAvailableBackend,
  extractCodeFromResponse,
  extractJsonFromResponse,
} from "./agent";

// Mock the server module
vi.mock("./server", () => ({
  getOpencodeServerInfo: vi.fn(),
}));

import { getOpencodeServerInfo } from "./server";
const mockGetOpencodeServerInfo = vi.mocked(getOpencodeServerInfo);

describe("OpenCode Agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("isOpencodeAvailable", () => {
    test("returns true when server is running with URL", () => {
      mockGetOpencodeServerInfo.mockReturnValue({
        status: "running",
        url: "http://localhost:4096",
      });

      expect(isOpencodeAvailable()).toBe(true);
    });

    test("returns false when server is stopped", () => {
      mockGetOpencodeServerInfo.mockReturnValue({
        status: "stopped",
      });

      expect(isOpencodeAvailable()).toBe(false);
    });

    test("returns false when server is running without URL", () => {
      mockGetOpencodeServerInfo.mockReturnValue({
        status: "running",
      });

      expect(isOpencodeAvailable()).toBe(false);
    });
  });

  describe("getOpencodeUrl", () => {
    test("returns URL when server is running", () => {
      mockGetOpencodeServerInfo.mockReturnValue({
        status: "running",
        url: "http://localhost:4096",
      });

      expect(getOpencodeUrl()).toBe("http://localhost:4096");
    });

    test("returns null when server is not running", () => {
      mockGetOpencodeServerInfo.mockReturnValue({
        status: "stopped",
      });

      expect(getOpencodeUrl()).toBeNull();
    });
  });

  describe("getAvailableBackend", () => {
    test("returns opencode when server is running", () => {
      mockGetOpencodeServerInfo.mockReturnValue({
        status: "running",
        url: "http://localhost:4096",
      });

      expect(getAvailableBackend()).toBe("opencode");
    });

    test("returns nvidia when NVIDIA_API_KEY is set", () => {
      mockGetOpencodeServerInfo.mockReturnValue({
        status: "stopped",
      });
      
      vi.stubGlobal("process", {
        ...process,
        env: { ...process.env, NVIDIA_API_KEY: "test-key" }
      });

      expect(getAvailableBackend()).toBe("nvidia");
    });

    test("returns null when no backend is available", () => {
      mockGetOpencodeServerInfo.mockReturnValue({
        status: "stopped",
      });

      const originalEnv = process.env.NVIDIA_API_KEY;
      delete process.env.NVIDIA_API_KEY;

      expect(getAvailableBackend()).toBeNull();

      if (originalEnv) {
        process.env.NVIDIA_API_KEY = originalEnv;
      }
    });
  });

  describe("extractCodeFromResponse", () => {
    test("extracts code from markdown code block", () => {
      const content = "Here is the code:\n```typescript\nconst x = 1;\n```";
      expect(extractCodeFromResponse(content)).toBe("const x = 1;");
    });

    test("extracts code from JSON with code field", () => {
      const content = JSON.stringify({ code: "const y = 2;" });
      expect(extractCodeFromResponse(content)).toBe("const y = 2;");
    });

    test("returns null for plain text without code", () => {
      const content = "Just some text without code";
      expect(extractCodeFromResponse(content)).toBeNull();
    });
  });

  describe("extractJsonFromResponse", () => {
    test("parses valid JSON string", () => {
      const content = '{"key": "value"}';
      expect(extractJsonFromResponse(content)).toEqual({ key: "value" });
    });

    test("extracts JSON embedded in text", () => {
      const content = 'Here is the result: {"status": "ok"} and more text';
      expect(extractJsonFromResponse(content)).toEqual({ status: "ok" });
    });

    test("returns null for invalid JSON", () => {
      const content = "Not JSON at all";
      expect(extractJsonFromResponse(content)).toBeNull();
    });
  });
});
