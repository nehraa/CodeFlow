/**
 * OpenCode HTTP client for code generation.
 *
 * Uses the OpenCode HTTP API (not CLI) to generate code from prompts.
 */

const OPENCODE_DEFAULT_URL = 'http://127.0.0.1:8080';

export interface OpencodeClientOptions {
  url?: string;
  timeout?: number;
}

export interface SendToOpencodeResult {
  success: boolean;
  content?: string;
  error?: string;
}

// Session cache for connection reuse
let cachedSessionId: string | null = null;
let cachedSessionUrl: string | null = null;

/**
 * Get or create an OpenCode session.
 */
async function getOrCreateSession(url: string): Promise<string> {
  // Reuse cached session if same URL
  if (cachedSessionId && cachedSessionUrl === url) {
    return cachedSessionId;
  }

  try {
    // Try to create a new session
    const response = await fetch(`${url}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    const text = await response.text();
    let sessionId: string;

    try {
      const parsed = JSON.parse(text) as { id?: string; sessionId?: string };
      sessionId = parsed.id || parsed.sessionId || text.trim();
    } catch {
      // Fallback to using the raw text as session ID
      sessionId = text.trim();
    }

    cachedSessionId = sessionId;
    cachedSessionUrl = url;
    return sessionId;
  } catch (err) {
    throw new Error(`Failed to connect to OpenCode at ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Send a message to the OpenCode server and get the response.
 */
export async function sendToOpencodeServer(
  prompt: string,
  options: OpencodeClientOptions = {}
): Promise<SendToOpencodeResult> {
  const url = options.url || process.env.OPENCODE_URL || OPENCODE_DEFAULT_URL;
  const timeout = options.timeout ?? 120000;

  try {
    const sessionId = await getOrCreateSession(url);

    const response = await fetch(`${url}/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text: prompt }]
      }),
      signal: AbortSignal.timeout(timeout)
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();

    // Parse response (OpenCode returns JSON with parts array)
    try {
      const parsed = JSON.parse(text) as { parts?: Array<{ text?: string }> };
      if (parsed.parts && Array.isArray(parsed.parts)) {
        const content = parsed.parts
          .map((p) => p.text || '')
          .join('');
        return { success: true, content };
      }
    } catch {
      // If not JSON, return raw text
    }

    return { success: true, content: text };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Clear the cached session (useful for error recovery).
 */
export function clearOpencodeSession(): void {
  cachedSessionId = null;
  cachedSessionUrl = null;
}