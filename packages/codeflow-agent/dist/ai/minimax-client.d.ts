/**
 * MiniMax API client for codeflow-agent.
 *
 * Uses MiniMax's chat completion API for AI-powered features.
 */
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
        delta?: {
            content?: string;
        };
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
 * Request chat completion from MiniMax API.
 */
export declare function requestMiniMaxChatCompletion(options: MiniMaxRequestOptions): Promise<string>;
/**
 * MiniMax chat completion streaming.
 */
export declare function streamMiniMaxChatCompletion(options: MiniMaxRequestOptions): AsyncGenerator<string, void, unknown>;
/**
 * Detect if MiniMax API key is configured.
 */
export declare function isMiniMaxConfigured(): boolean;
//# sourceMappingURL=minimax-client.d.ts.map