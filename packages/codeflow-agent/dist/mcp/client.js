import { listMcpTools, invokeMcpTool, extractTextFromMcpResult } from '@abhinav2203/codeflow-mcp';
/**
 * Client wrapper for the codeflow-mcp package.
 * Discovers and invokes tools on MCP servers.
 */
export class McpToolClient {
    /**
     * List all tools available on an MCP server.
     */
    async listTools(serverUrl) {
        return listMcpTools(serverUrl);
    }
    /**
     * Invoke a named tool on an MCP server with the given arguments.
     */
    async invoke(serverUrl, toolName, args) {
        return invokeMcpTool(serverUrl, toolName, args);
    }
    /**
     * Extract plain-text content from an MCP tool result.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getText(result) {
        return extractTextFromMcpResult(result);
    }
}
