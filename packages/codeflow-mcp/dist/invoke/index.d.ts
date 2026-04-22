/**
 * codeflow-mcp MCP server
 *
 * Implements the MCP spec with three transports:
 * - stdio:  for Claude Code CLI, Cursor, local tools
 * - HTTP:   for web clients, Claude Desktop
 * - SSE:    for streaming responses (Claude Desktop, Cursor)
 *
 * The server is transport-agnostic — the same handler logic runs regardless
 * of how the client connects. Each transport implements the same JSON-RPC
 * protocol over its channel.
 */
import { type Server } from "node:http";
import { TOOLS } from "../tools/index.js";
interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    } | {
        type: "image";
        data: string;
        mimeType: string;
    }>;
    isError?: boolean;
}
interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: number | string | null;
    method: string;
    params?: Record<string, unknown>;
}
interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: number | string | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
    };
}
declare function jsonRpcError(id: unknown, code: number, message: string): JsonRpcResponse;
declare function jsonRpcResult(id: unknown, result: unknown): JsonRpcResponse;
declare function handleJsonRpc(req: JsonRpcRequest): Promise<JsonRpcResponse>;
/**
 * MCP over stdio — the standard MCP transport for local tools and AI IDEs.
 *
 * Protocol:
 *   - Client sends JSON-RPC messages (one per line, \n-delimited)
 *   - Server sends JSON-RPC responses (one per line, \n-delimited)
 *   - Connection stays open until client sends "terminate" or closes stdin
 *
 * This is how Claude Code CLI, Cursor, and Claude Desktop connect.
 */
export declare function startStdioServer(): Promise<void>;
/**
 * Start HTTP server with both plain JSON-RPC and SSE streaming endpoints.
 *
 * Endpoints:
 *   POST / — JSON-RPC (request/response, compatible with all HTTP MCP clients)
 *   GET  /sse — SSE stream for streaming responses (Claude Desktop, Cursor)
 */
export declare function createHttpServer(port?: number, host?: string): Server;
export { TOOLS, handleJsonRpc, jsonRpcError, jsonRpcResult };
export type { ToolResult, JsonRpcRequest, JsonRpcResponse };
//# sourceMappingURL=index.d.ts.map