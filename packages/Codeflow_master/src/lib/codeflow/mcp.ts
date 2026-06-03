/**
 * codeflow-mcp wrapper
 * MCP server configuration and tool registry for CodeFlow blueprint operations
 */
import type { ToolDefinition, MCPServerConfig, MCPServer, MCPMessage } from '@/types/codeflow-mcp';

// Re-export types
export type { ToolDefinition, MCPServerConfig, MCPServer, MCPMessage };

// Tool registry implementation
class MCPServerImpl implements MCPServer {
  private tools: Map<string, ToolDefinition> = new Map();
  private registeredAgents: string[] = [];
  private permissions: MCPServerConfig['permissions'];

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    console.log(`[codeflow-mcp] Tool registered: ${tool.name}`);
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
    console.log(`[codeflow-mcp] Tool unregistered: ${name}`);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, args: any[]): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    try {
      return await tool.handler(...args);
    } catch (error: any) {
      console.error(`[codeflow-mcp] Tool execution error: ${name}`, error);
      throw error;
    }
  }

  registerAgent(agentId: string): void {
    if (!this.registeredAgents.includes(agentId)) {
      this.registeredAgents.push(agentId);
      console.log(`[codeflow-mcp] Agent registered: ${agentId}`);
    }
  }

  unregisterAgent(agentId: string): void {
    this.registeredAgents = this.registeredAgents.filter((id) => id !== agentId);
  }

  getConfig(): MCPServerConfig {
    return {
      tools: this.tools,
      registeredAgents: this.registeredAgents,
      permissions: this.permissions,
    };
  }

  setPermissions(permissions: MCPServerConfig['permissions']): void {
    this.permissions = permissions;
  }
}

// Singleton instance
let mcpServer: MCPServer | null = null;

export function getMCPServer(): MCPServer {
  if (!mcpServer) {
    mcpServer = new MCPServerImpl();
    // Register built-in tools
    initializeBuiltInTools(mcpServer);
  }
  return mcpServer;
}

function initializeBuiltInTools(server: MCPServer): void {
  server.registerTool({
    name: 'codeflow_analyze',
    description: 'Analyze repository structure and generate metrics',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to repository' },
      },
      required: ['path'],
    },
    handler: async (args: { path: string }) => {
      const { analyzeRepository } = await import('./core');
      return analyzeRepository(args.path);
    },
  });

  server.registerTool({
    name: 'codeflow_blueprint',
    description: 'Generate code blueprint from specification',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'object', description: 'Blueprint specification' },
      },
      required: ['spec'],
    },
    handler: async (args: { spec: any }) => {
      const { generateBlueprint } = await import('./core');
      return generateBlueprint(args.spec);
    },
  });

  server.registerTool({
    name: 'codeflow_checkpoint',
    description: 'Create session checkpoint',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'object', description: 'Checkpoint data' },
        label: { type: 'string', description: 'Optional label' },
      },
      required: ['data'],
    },
    handler: async (args: { data: any; label?: string }) => {
      const { useSessionStore } = await import('./store');
      useSessionStore.getState().addCheckpoint(args.data, args.label);
      return { success: true, checkpointId: `cp-${Date.now()}` };
    },
  });

  server.registerTool({
    name: 'codeflow_export',
    description: 'Export blueprint to various formats',
    inputSchema: {
      type: 'object',
      properties: {
        nodes: { type: 'array', description: 'Blueprint nodes' },
        format: { type: 'string', enum: ['json', 'yaml', 'markdown'] },
      },
      required: ['nodes', 'format'],
    },
    handler: async (args: { nodes: any[]; format: 'json' | 'yaml' | 'markdown' }) => {
      const { exportBlueprint } = await import('./core');
      return exportBlueprint(args.nodes, args.format);
    },
  });
}

// MCP client for connecting to external servers
export interface MCPClient {
  connect(url: string, apiKey?: string): Promise<void>;
  disconnect(): void;
  send(message: MCPMessage): Promise<MCPMessage>;
  isConnected(): boolean;
}

export async function createMCPClient(config: { serverUrl: string; apiKey?: string }): Promise<MCPClient> {
  // Stub implementation - real implementation would use WebSocket
  return {
    isConnected: () => false,
    connect: async () => {},
    disconnect: () => {},
    send: async () => ({ type: 'response', id: '', result: {} }),
  };
}