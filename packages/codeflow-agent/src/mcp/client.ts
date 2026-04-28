import {
  listMcpTools,
  invokeMcpTool,
  extractTextFromMcpResult
} from '@abhinav2203/codeflow-mcp';
import type { McpTool, McpToolResult } from '@abhinav2203/codeflow-core/schema';

/**
 * Client wrapper for the codeflow-mcp package.
 * Discovers and invokes tools on MCP servers.
 */
export class McpToolClient {
  /**
   * List all tools available on an MCP server.
   */
  async listTools(serverUrl: string): Promise<McpTool[]> {
    return listMcpTools(serverUrl);
  }

  /**
   * Invoke a named tool on an MCP server with the given arguments.
   */
  async invoke(
    serverUrl: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<McpToolResult> {
    return invokeMcpTool(serverUrl, toolName, args);
  }

  /**
   * Extract plain-text content from an MCP tool result.
   */
  getText(result: McpToolResult): string {
    return extractTextFromMcpResult(result);
  }
}