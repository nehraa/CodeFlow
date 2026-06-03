import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError, TransportError } from "../errors/index.js";
import { CustomHttpTransport, OpenAiCompatibleTransport } from "../llm/transports.js";

const requestPayload = {
  question: "hi",
  model: "local-model",
  stream: true,
  context: {
    question: "hi",
    answerMode: "llm" as const,
    primaryNode: null,
    relatedNodes: [],
    graphSummary: "",
    warnings: []
  },
  messages: []
};

const createStreamResponse = (
  chunks: string[],
  init: ResponseInit = {
    status: 200,
    headers: { "content-type": "application/json" }
  }
): Response =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }

        controller.close();
      }
    }),
    init
  );

const parsePostedMessages = (callIndex: number): Array<{ role: string; content: string }> => {
  const fetchMock = vi.mocked(globalThis.fetch);
  const requestInit = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  const body = typeof requestInit?.body === "string" ? requestInit.body : "{}";
  return (JSON.parse(body) as { messages?: Array<{ role: string; content: string }> }).messages ?? [];
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LLM transports", () => {
  it("parses OpenAI-compatible SSE responses across split chunks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createStreamResponse(
        ['data: {"choices":[{"delta":{"content":"hel', 'lo "}}]}\n\n', 'data: {"choices":[{"delta":{"content":"world"}}]}\n\n', "data: [DONE]\n\n"],
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );

    const transport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    const response = await transport.generate(requestPayload);
    expect(response.answer).toBe("hello world");
  });

  it("parses custom ndjson streaming responses across split chunks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createStreamResponse(['{"token":"first', ' "}\n{"token":"second"}\n'])
    );

    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "ndjson",
      headers: {}
    });

    const response = await transport.generate(requestPayload);
    expect(response.answer).toBe("first second");
  });

  it("parses ndjson responses that end with a final buffered token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(createStreamResponse(['{"answer":"tail"}']));
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "ndjson",
      headers: {}
    });

    const response = await transport.generate(requestPayload);
    expect(response.answer).toBe("tail");
  });

  it("treats empty NDJSON bodies as empty answers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "ndjson",
      headers: {}
    });

    const response = await transport.generate(requestPayload);
    expect(response.answer).toBe("");
  });

  it("parses custom SSE responses and forwards streamed tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createStreamResponse(
        ['data: {"token":"one"}\n\n', 'data: {"token":" two"}\n\n'],
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );
    const onToken = vi.fn();
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "sse",
      headers: {}
    });

    const response = await transport.generate(requestPayload, onToken);
    expect(response.answer).toBe("one two");
    expect(onToken).toHaveBeenCalledTimes(2);
  });

  it("parses a final buffered SSE payload without a trailing event separator", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createStreamResponse(
        ['data: {"token":"tail"}'],
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "sse",
      headers: {}
    });

    const response = await transport.generate(requestPayload);
    expect(response.answer).toBe("tail");
  });

  it("skips empty tokens in the final buffered SSE payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createStreamResponse(
        ['data: {}'],
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "sse",
      headers: {}
    });

    const response = await transport.generate(requestPayload);
    expect(response.answer).toBe("");
  });

  it("skips empty streamed payloads and attaches authorization headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createStreamResponse(
        ['data: {}\n\n', 'data: {"answer":"token"}\n\n'],
        { status: 200, headers: { "content-type": "text/event-stream" } }
      )
    );
    const onToken = vi.fn();
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      apiKey: "secret",
      timeoutMs: 5000,
      customHttpFormat: "sse",
      headers: { "x-extra": "1" }
    });

    const response = await transport.generate(requestPayload, onToken);

    expect(response.answer).toBe("token");
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("/", "http://127.0.0.1:1234"),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer secret",
          "x-extra": "1"
        })
      })
    );
  });

  it("parses JSON answers from both transport shapes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "json answer" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const transport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    const response = await transport.generate({ ...requestPayload, stream: false });
    expect(response.answer).toBe("json answer");
  });

  it("resolves OpenAI-compatible paths under a base URL that already includes /v1", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const transport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "https://example.com/api/v1",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    await transport.generate({ ...requestPayload, stream: false });

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://example.com/api/v1/chat/completions"),
      expect.any(Object)
    );
  });

  it("reuses base URLs that already end with a trailing slash", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const transport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "https://example.com/api/v1/",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    await transport.generate({ ...requestPayload, stream: false });

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://example.com/api/v1/chat/completions"),
      expect.any(Object)
    );
  });

  it("retries OpenAI-compatible requests by folding system prompts into user content", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "System role not supported System role not supported" }
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ answer: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );

    const transport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    const response = await transport.generate({
      ...requestPayload,
      stream: false,
      messages: [
        { role: "system", content: "Answer carefully." },
        { role: "user", content: "Where is indexing handled?" }
      ]
    });

    expect(response.answer).toBe("ok");
    expect(parsePostedMessages(0)).toEqual([
      { role: "system", content: "Answer carefully." },
      { role: "user", content: "Where is indexing handled?" }
    ]);
    expect(parsePostedMessages(1)).toEqual([
      {
        role: "user",
        content: "Answer carefully.\n\nWhere is indexing handled?"
      }
    ]);
  });

  it("creates a synthetic user message when system prompts must be retried without any user content", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "System role not supported System role not supported" }
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ answer: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );

    const transport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    const response = await transport.generate({
      ...requestPayload,
      stream: false,
      messages: [
        { role: "system", content: "Answer carefully." },
        { role: "assistant", content: "Prior context" }
      ]
    });

    expect(response.answer).toBe("ok");
    expect(parsePostedMessages(1)).toEqual([
      { role: "user", content: "Answer carefully." },
      { role: "assistant", content: "Prior context" }
    ]);
  });

  it("retries unsupported-system-role responses even when the original request had no system messages", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "System role not supported System role not supported" }
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ answer: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );

    const transport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    const response = await transport.generate({
      ...requestPayload,
      stream: false,
      messages: [{ role: "user", content: "Where is indexing handled?" }]
    });

    expect(response.answer).toBe("ok");
    expect(parsePostedMessages(1)).toEqual([{ role: "user", content: "Where is indexing handled?" }]);
  });

  it("does not retry non-system-role transport errors from OpenAI-compatible requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad request" } }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );

    const transport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    await expect(
      transport.generate({
        ...requestPayload,
        stream: false,
        messages: [
          { role: "system", content: "Answer carefully." },
          { role: "user", content: "Where is indexing handled?" }
        ]
      })
    ).rejects.toThrow(TransportError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("rethrows parser failures from OpenAI-compatible responses without retrying", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{", {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const transport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    await expect(
      transport.generate({
        ...requestPayload,
        stream: false,
        messages: [{ role: "user", content: "Where is indexing handled?" }]
      })
    ).rejects.toThrow(SyntaxError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("parses direct answer fields from JSON responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "plain answer" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    const response = await transport.generate({ ...requestPayload, stream: false });
    expect(response.answer).toBe("plain answer");
  });

  it("posts custom HTTP requests to the configured base URL root", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "https://example.com/custom/path",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    await transport.generate({ ...requestPayload, stream: false });

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://example.com/custom/path/"),
      expect.any(Object)
    );
  });

  it("retries transient server failures and then succeeds", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "retry" }), {
          status: 503,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ answer: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );

    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    const response = await transport.generate({ ...requestPayload, stream: false });
    expect(response.answer).toBe("ok");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws structured transport errors for unreachable servers", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connect failed"));
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 100,
      customHttpFormat: "json",
      headers: {}
    });

    await expect(transport.generate({ ...requestPayload, stream: false })).rejects.toThrow(TransportError);
  });

  it("retries transient network failures before succeeding", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ answer: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );

    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    const response = await transport.generate({ ...requestPayload, stream: false });
    expect(response.answer).toBe("ok");
  });

  it("validates required transport config and response shapes", async () => {
    const openAiTransport = new OpenAiCompatibleTransport({
      enabled: true,
      transport: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234",
      timeoutMs: 100,
      customHttpFormat: "json",
      headers: {}
    });
    await expect(openAiTransport.generate(requestPayload)).rejects.toThrow(ConfigurationError);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ nope: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    await expect(transport.generate({ ...requestPayload, stream: false })).rejects.toThrow(TransportError);
  });

  it("surfaces final HTTP errors after exhausting retryable statuses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "retry" }), {
        status: 503,
        headers: { "content-type": "application/json" }
      })
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    await expect(transport.generate({ ...requestPayload, stream: false })).rejects.toThrow(TransportError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("surfaces non-retryable HTTP errors immediately", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad request" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    await expect(transport.generate({ ...requestPayload, stream: false })).rejects.toThrow(TransportError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles missing SSE bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "sse",
      headers: {}
    });

    await expect(transport.generate(requestPayload)).rejects.toThrow(TransportError);
  });

  it("surfaces SSE transport errors for non-OK responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad gateway" }), { status: 502 })
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "sse",
      headers: {}
    });

    await expect(transport.generate(requestPayload)).rejects.toThrow(TransportError);
  });

  it("surfaces NDJSON transport errors for non-OK responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad gateway" }), { status: 502 })
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "ndjson",
      headers: {}
    });

    await expect(transport.generate(requestPayload)).rejects.toThrow(TransportError);
  });

  it("skips empty NDJSON tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createStreamResponse(['{}\n{"token":"next"}\n'])
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "ndjson",
      headers: {}
    });

    const response = await transport.generate(requestPayload);
    expect(response.answer).toBe("next");
  });

  it("skips empty final buffered NDJSON tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(createStreamResponse(['{}']));
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "ndjson",
      headers: {}
    });

    const response = await transport.generate(requestPayload);
    expect(response.answer).toBe("");
  });

  it("uses the configured model when the request does not override it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ answer: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const transport = new CustomHttpTransport({
      enabled: true,
      transport: "custom-http",
      baseUrl: "http://127.0.0.1:1234",
      model: "local-model",
      timeoutMs: 5000,
      customHttpFormat: "json",
      headers: {}
    });

    await transport.generate({ ...requestPayload, model: undefined, stream: false });

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init).toBeDefined();
    expect(JSON.parse(String(init.body)).model).toBe("local-model");
  });

  it("rejects missing base urls for custom transports", async () => {
    expect(
      () =>
        new CustomHttpTransport({
          enabled: true,
          transport: "custom-http",
          timeoutMs: 100,
          customHttpFormat: "json",
          headers: {}
        })
    ).toThrow(ConfigurationError);
  });
});
