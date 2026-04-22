import type { McpTool, McpToolResult } from "@abhinav2203/codeflow-core/schema";
/**
 * Discover the tools exposed by an MCP server via the `tools/list` JSON-RPC method.
 */
export declare const listMcpTools: (serverUrl: string, headers?: Record<string, string>) => Promise<McpTool[]>;
/**
 * Invoke a named tool on an MCP server via the `tools/call` JSON-RPC method.
 */
export declare const invokeMcpTool: (serverUrl: string, toolName: string, args: Record<string, unknown>, headers?: Record<string, string>) => Promise<McpToolResult>;
/**
 * Extract a plain-text summary from an MCP tool result's content array.
 */
export declare const extractTextFromMcpResult: (result: McpToolResult) => string;
//# sourceMappingURL=index.d.ts.map