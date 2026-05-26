/**
 * OpenCode HTTP client for code generation.
 *
 * Uses the OpenCode HTTP API (not CLI) to generate code from prompts.
 *
 * Supported providers (for OpenCode configuration):
 * - anthropic, openai, google, azure, bedrock, cohere, groq, mistral,
 * - perplexity, openrouter, minimax, local
 */
export type OpenCodeProvider = 'anthropic' | 'openai' | 'google' | 'azure' | 'bedrock' | 'cohere' | 'groq' | 'mistral' | 'perplexity' | 'openrouter' | 'minimax' | 'local';
export interface OpencodeClientOptions {
    url?: string;
    timeout?: number;
    provider?: OpenCodeProvider;
}
export interface SendToOpencodeResult {
    success: boolean;
    content?: string;
    error?: string;
}
/**
 * Send a message to the OpenCode server and get the response.
 */
export declare function sendToOpencodeServer(prompt: string, options?: OpencodeClientOptions): Promise<SendToOpencodeResult>;
/**
 * Clear the cached session (useful for error recovery).
 */
export declare function clearOpencodeSession(): void;
//# sourceMappingURL=opencode-client.d.ts.map