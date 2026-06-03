import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "../errors/index.js";
import { GeminiEmbeddingProvider } from "../indexer/gemini-embedder.js";

const GEMINI_KEY_ENV = "CODERAG_GEMINI_API_KEY";
const GEMINI_KEY_ALIAS_ENV = "CODERAG_GEMINI_AI_KEY";
const GEMINI_MODEL_ENV = "CODERAG_GEMINI_MODEL";

afterEach(() => {
  delete process.env[GEMINI_KEY_ENV];
  delete process.env[GEMINI_KEY_ALIAS_ENV];
  delete process.env[GEMINI_MODEL_ENV];
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GeminiEmbeddingProvider", () => {
  it("requires an API key", () => {
    delete process.env[GEMINI_KEY_ENV];
    delete process.env[GEMINI_KEY_ALIAS_ENV];
    expect(() => new GeminiEmbeddingProvider()).toThrow(ConfigurationError);
  });

  it("uses explicit config for single embeds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: [0.1, 0.2] } }), { status: 200 })
    );
    const provider = new GeminiEmbeddingProvider({
      apiKey: "config-key",
      model: "models/custom-embedder",
      timeoutMs: 1234
    });

    await expect(provider.embed("hello")).resolves.toEqual([0.1, 0.2]);
    expect(provider.model).toBe("models/custom-embedder");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/custom-embedder:embedContent?key=config-key",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      content: {
        parts: [{ text: "hello" }]
      },
      outputDimensionality: 768
    });
  });

  it("uses env defaults when config is omitted", async () => {
    process.env[GEMINI_KEY_ENV] = "env-key";
    process.env[GEMINI_MODEL_ENV] = "models/env-embedder";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: [1, 2, 3] } }), { status: 200 })
    );
    const provider = new GeminiEmbeddingProvider();

    await expect(provider.embed("hello from env")).resolves.toEqual([1, 2, 3]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/env-embedder:embedContent?key=env-key",
      expect.any(Object)
    );
  });

  it("accepts the AI_KEY env alias when the canonical key is unset", async () => {
    process.env[GEMINI_KEY_ALIAS_ENV] = "alias-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: [9, 8, 7] } }), { status: 200 })
    );
    const provider = new GeminiEmbeddingProvider();

    await expect(provider.embed("hello from alias env")).resolves.toEqual([9, 8, 7]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=alias-key",
      expect.any(Object)
    );
  });

  it("uses the default model when none is configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: [7] } }), { status: 200 })
    );
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key" });

    await expect(provider.embed("default model")).resolves.toEqual([7]);
    expect(provider.model).toBe("models/gemini-embedding-2");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=config-key",
      expect.any(Object)
    );
  });

  it("surfaces API errors for single embeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad request", { status: 400, statusText: "Bad Request" }));
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key" });

    await expect(provider.embed("bad")).rejects.toThrow("Gemini API error: 400 Bad Request - bad request");
  });

  it("rejects invalid single-embed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ embedding: {} }), { status: 200 }));
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key" });

    await expect(provider.embed("missing values")).rejects.toThrow(
      "Invalid response from Gemini API: missing embedding values"
    );
  });

  it("surfaces timeouts for single embeds", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const signal = init?.signal;
      return await new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key", timeoutMs: 1 });
    const expectation = expect(provider.embed("timeout")).rejects.toThrow("Gemini API request timed out after 1ms");

    await vi.advanceTimersByTimeAsync(1);
    await expectation;
    vi.useRealTimers();
  });

  it("returns an empty result for empty batches", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key" });

    await expect(provider.embedBatch([])).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects batches over the Gemini API limit", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key" });

    await expect(provider.embedBatch(new Array(101).fill("too-many"))).rejects.toThrow(
      "Batch size 101 exceeds Gemini API limit of 100. Split into smaller batches."
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses explicit config for batch embeds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ embeddings: [{ values: [1] }, { values: [2] }] }), { status: 200 })
    );
    const provider = new GeminiEmbeddingProvider({
      apiKey: "config-key",
      model: "models/batch-embedder"
    });

    await expect(provider.embedBatch(["first", "second"])).resolves.toEqual([[1], [2]]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/batch-embedder:batchEmbedContents?key=config-key",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      requests: [
        {
          model: "models/batch-embedder",
          content: {
            parts: [{ text: "first" }]
          },
          outputDimensionality: 768
        },
        {
          model: "models/batch-embedder",
          content: {
            parts: [{ text: "second" }]
          },
          outputDimensionality: 768
        }
      ]
    });
  });

  it("surfaces API errors for batch embeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad gateway", { status: 502, statusText: "Bad Gateway" }));
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key" });

    await expect(provider.embedBatch(["bad"])).rejects.toThrow("Gemini API error: 502 Bad Gateway - bad gateway");
  });

  it("rejects mismatched batch responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ embeddings: [{ values: [1] }] }), { status: 200 })
    );
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key" });

    await expect(provider.embedBatch(["first", "second"])).rejects.toThrow(
      "Invalid response from Gemini API: mismatched embedding count"
    );
  });

  it("treats missing batch embedding values as empty vectors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ embeddings: [{}, { values: [2] }] }), { status: 200 })
    );
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key" });

    await expect(provider.embedBatch(["first", "second"])).resolves.toEqual([[], [2]]);
  });

  it("surfaces timeouts for batch embeds", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const signal = init?.signal;
      return await new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key", timeoutMs: 5 });
    const expectation = expect(provider.embedBatch(["timeout"])).rejects.toThrow("Gemini API request timed out after 5ms");

    await vi.advanceTimersByTimeAsync(5);
    await expectation;
    vi.useRealTimers();
  });

  it("has maxInputTokens set to 8192 for gemini-embedding-2 model", () => {
    const provider = new GeminiEmbeddingProvider({ apiKey: "config-key" });
    expect(provider.maxInputTokens).toBe(8192);
  });
});
