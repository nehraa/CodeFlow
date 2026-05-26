import type { McpTool, McpToolResult } from '@abhinav2203/codeflow-core/schema';
/**
 * Client wrapper for the codeflow-mcp package.
 * Discovers and invokes tools on MCP servers.
 */
export declare class McpToolClient {
    /**
     * List all tools available on an MCP server.
     */
    listTools(serverUrl: string): Promise<McpTool[]>;
    /**
     * Invoke a named tool on an MCP server with the given arguments.
     */
    invoke(serverUrl: string, toolName: string, args: Record<string, unknown>): Promise<McpToolResult>;
    /**
     * Extract plain-text content from an MCP tool result.
     */
    getText(result: {
        content: Array<{
            type: string;
            text?: string;
        }>;
    }): string;
}
//# sourceMappingURL=client.d.ts.map