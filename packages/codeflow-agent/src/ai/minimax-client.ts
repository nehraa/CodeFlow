/**
 * MiniMax API client for codeflow-agent.
 *
 * Uses MiniMax's chat completion API for AI-powered features.
 */

const MINIMAX_API_URL = 'https://api.minimax.io/v1';

export interface MiniMaxChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MiniMaxChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface MiniMaxStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string;
  }>;
}

export interface MiniMaxRequestOptions {
  apiKey: string;
  messages: MiniMaxChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeout?: number;
}

/**
 * Build headers for MiniMax API request.
 */
function buildHeaders(apiKey: string): HeadersInit {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Request chat completion from MiniMax API.
 */
export async function requestMiniMaxChatCompletion(options: MiniMaxRequestOptions): Promise<string> {
  const {
    apiKey,
    messages,
    model = 'MiniMax-M2.7',
    temperature = 0.3,
    maxTokens = 4096,
    timeout = 120000,
  } = options;

  const response = await fetch(`${MINIMAX_API_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content in MiniMax API response');
  }
  return content;
}

/**
 * MiniMax chat completion streaming.
 */
export async function* streamMiniMaxChatCompletion(
  options: MiniMaxRequestOptions
): AsyncGenerator<string, void, unknown> {
  const {
    apiKey,
    messages,
    model = 'MiniMax-M2.7',
    temperature = 0.3,
    maxTokens = 4096,
    timeout = 120000,
  } = options;

  const response = await fetch(`${MINIMAX_API_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('MiniMax API response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            return;
          }
          try {
            const parsed = JSON.parse(dataStr) as MiniMaxStreamChunk;
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Detect if MiniMax API key is configured.
 */
export function isMiniMaxConfigured(): boolean {
  return !!(
    process.env.MINIMAX_API_KEY ||
    process.env.MINIMAX_API_KEY?.length
  );
}