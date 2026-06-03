import { ConfigurationError, TransportError } from "../errors/index.js";
import type { CustomHttpFormat, LlmConfig, LlmRequest, LlmResponse, LlmTransport } from "../types.js";

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_HTTP_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 150;

const buildHeaders = (config: LlmConfig): Record<string, string> => {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...config.headers
  };

  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`;
  }

  return headers;
};

const waitBeforeRetry = async (attempt: number): Promise<void> => {
  const jitterMs = Math.floor(Math.random() * RETRY_BASE_DELAY_MS);
  const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt + jitterMs;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const shouldRetryStatus = (status: number): boolean => RETRYABLE_STATUS_CODES.has(status);

const mergeSystemMessagesIntoConversation = (
  messages: LlmRequest["messages"]
): LlmRequest["messages"] => {
  const systemPrompt = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!systemPrompt) {
    return messages;
  }

  const nonSystemMessages = messages.filter((message) => message.role !== "system");
  const firstUserMessageIndex = nonSystemMessages.findIndex((message) => message.role === "user");
  if (firstUserMessageIndex === -1) {
    return [{ role: "user", content: systemPrompt }, ...nonSystemMessages];
  }

  const firstUserMessage = nonSystemMessages[firstUserMessageIndex]!;
  const mergedUserMessage = {
    ...firstUserMessage,
    content: `${systemPrompt}\n\n${firstUserMessage.content}`.trim()
  };

  return [
    ...nonSystemMessages.slice(0, firstUserMessageIndex),
    mergedUserMessage,
    ...nonSystemMessages.slice(firstUserMessageIndex + 1)
  ];
};

const isUnsupportedSystemRoleError = (error: unknown): boolean => {
  if (!(error instanceof TransportError)) {
    return false;
  }

  const status = error.details?.status;
  const body = error.details?.body;
  return status === 400 && typeof body === "string" && body.toLowerCase().includes("system role not supported");
};

const buildRequestUrl = (baseUrl: string, pathname: string): URL => {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  if (pathname === "/" || pathname.length === 0) {
    return new URL(normalizedBaseUrl);
  }

  const normalizedPath = pathname.replace(/^\/+/, "");
  return new URL(normalizedPath, normalizedBaseUrl);
};

const readResponseText = async (response: Response): Promise<string> => {
  const text = await response.text();
  if (!response.ok) {
    throw new TransportError("LLM server returned an error response.", {
      status: response.status,
      body: text
    });
  }

  return text;
};

const extractAnswerToken = (payload: Record<string, unknown>): string => {
  if (typeof payload.token === "string") {
    return payload.token;
  }

  if (typeof payload.answer === "string") {
    return payload.answer;
  }

  const content = (payload.choices as Array<{ delta?: { content?: string } }> | undefined)?.[0]?.delta?.content;
  return typeof content === "string" ? content : "";
};

const parseSseEvent = (rawEvent: string): string[] =>
  rawEvent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((payload) => payload.length > 0 && payload !== "[DONE]");

const readSseResponse = async (response: Response, onToken?: (token: string) => void): Promise<LlmResponse> => {
  if (!response.ok) {
    await readResponseText(response);
  }

  if (!response.body) {
    throw new TransportError("SSE response did not include a body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop()!;

    for (const event of events) {
      for (const payload of parseSseEvent(event)) {
        const token = extractAnswerToken(JSON.parse(payload) as Record<string, unknown>);
        if (!token) {
          continue;
        }

        answer += token;
        onToken?.(token);
      }
    }
  }

  if (buffer.trim().length > 0) {
    for (const payload of parseSseEvent(buffer)) {
      const token = extractAnswerToken(JSON.parse(payload) as Record<string, unknown>);
      if (!token) {
        continue;
      }

      answer += token;
      onToken?.(token);
    }
  }

  return { answer };
};

const readNdjsonResponse = async (response: Response, onToken?: (token: string) => void): Promise<LlmResponse> => {
  if (!response.ok) {
    await readResponseText(response);
  }

  if (!response.body) {
    const text = await readResponseText(response);
    return { answer: text };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop()!;

    for (const line of lines.map((candidate) => candidate.trim()).filter(Boolean)) {
      const token = extractAnswerToken(JSON.parse(line) as Record<string, unknown>);
      if (!token) {
        continue;
      }

      answer += token;
      onToken?.(token);
    }
  }

  if (buffer.trim().length > 0) {
    const token = extractAnswerToken(JSON.parse(buffer.trim()) as Record<string, unknown>);
    if (token) {
      answer += token;
      onToken?.(token);
    }
  }

  return { answer };
};

const readJsonAnswer = async (response: Response): Promise<LlmResponse> => {
  const text = await readResponseText(response);
  const parsed = JSON.parse(text) as Record<string, unknown>;

  if (typeof parsed.answer === "string") {
    return { answer: parsed.answer };
  }

  const content = (parsed.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content;
  if (typeof content === "string") {
    return { answer: content };
  }

  throw new TransportError("LLM response did not contain a supported answer field.");
};

abstract class HttpLlmTransport implements LlmTransport {
  abstract readonly kind: LlmTransport["kind"];

  protected readonly config: LlmConfig;

  constructor(config: LlmConfig) {
    if (!config.baseUrl) {
      throw new ConfigurationError("LLM transport requires a baseUrl.");
    }

    this.config = config;
  }

  protected async postJson(pathname: string, body: unknown): Promise<Response> {
    let lastResponse: Response | undefined;
    let lastError: unknown = new Error("HTTP retry loop exhausted without a response.");

    for (let attempt = 0; attempt < MAX_HTTP_RETRIES; attempt += 1) {
      try {
        const signal = AbortSignal.timeout(this.config.timeoutMs);
        const response = await fetch(buildRequestUrl(this.config.baseUrl!, pathname), {
          method: "POST",
          headers: buildHeaders(this.config),
          body: JSON.stringify(body),
          signal
        });

        if (!shouldRetryStatus(response.status)) {
          return response;
        }
        lastResponse = response;
      } catch (error) {
        lastError = error;
      }

      if (attempt < MAX_HTTP_RETRIES - 1) {
        await waitBeforeRetry(attempt);
      }
    }

    if (lastResponse) {
      return lastResponse;
    }

    throw new TransportError("Failed to reach the configured LLM server.", {
      baseUrl: this.config.baseUrl
    }, { cause: lastError });
  }

  abstract generate(request: LlmRequest, onToken?: (token: string) => void): Promise<LlmResponse>;
}

/**
 * Talks to any model server that exposes the OpenAI chat completions contract.
 */
export class OpenAiCompatibleTransport extends HttpLlmTransport {
  readonly kind = "openai-compatible" as const;

  async generate(request: LlmRequest, onToken?: (token: string) => void): Promise<LlmResponse> {
    if (!this.config.model) {
      throw new ConfigurationError("OpenAI-compatible transport requires a model.");
    }

    const execute = async (messages: LlmRequest["messages"]): Promise<LlmResponse> => {
      const response = await this.postJson("/chat/completions", {
        model: this.config.model,
        stream: request.stream,
        messages
      });

      return request.stream ? readSseResponse(response, onToken) : readJsonAnswer(response);
    };

    try {
      return await execute(request.messages);
    } catch (error) {
      if (!isUnsupportedSystemRoleError(error)) {
        throw error;
      }

      return execute(mergeSystemMessagesIntoConversation(request.messages));
    }
  }
}

/**
 * Talks to a custom JSON, NDJSON, or SSE endpoint that accepts the CodeRag payload.
 */
export class CustomHttpTransport extends HttpLlmTransport {
  readonly kind = "custom-http" as const;

  async generate(request: LlmRequest, onToken?: (token: string) => void): Promise<LlmResponse> {
    const response = await this.postJson("/", {
      question: request.question,
      model: request.model ?? this.config.model,
      stream: request.stream,
      context: request.context,
      messages: request.messages
    });

    const format: CustomHttpFormat = this.config.customHttpFormat;
    if (format === "sse") {
      return readSseResponse(response, onToken);
    }

    if (format === "ndjson") {
      return readNdjsonResponse(response, onToken);
    }

    return readJsonAnswer(response);
  }
}
