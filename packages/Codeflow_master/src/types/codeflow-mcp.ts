/**
 * Type definitions for @abhinav2203/codeflow-mcp
 * MCP server configuration and tool registry for CodeFlow blueprint operations
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  handler: (...args: any[]) => Promise<any>;
  permissions?: string[];
}

export interface ToolExecution {
  toolName: string;
  arguments: any[];
  result?: any;
  error?: string;
  duration?: number;
  timestamp: number;
}

export interface MCPServerConfig {
  tools: Map<string, ToolDefinition>;
  registeredAgents: string[];
  permissions?: {
    allowList?: string[];
    denyList?: string[];
  };
}

export interface MCPServer {
  registerTool(tool: ToolDefinition): void;
  unregisterTool(name: string): void;
  getTool(name: string): ToolDefinition | undefined;
  listTools(): ToolDefinition[];
  executeTool(name: string, args: any[]): Promise<any>;
  registerAgent(agentId: string): void;
  unregisterAgent(agentId: string): void;
  getConfig(): MCPServerConfig;
}

export interface MCPClientConfig {
  serverUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

export interface MCPMessage {
  type: 'request' | 'response' | 'notification';
  id: string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}