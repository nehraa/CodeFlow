import { mcpRegistry, type McpServerEntry } from './registry.js';

export interface McpConnection {
  serverId: string;
  connected: boolean;
  tools: string[];
}

export class McpConnector {
  private connections: Map<string, McpConnection> = new Map();

  async connect(serverId: string): Promise<McpConnection> {
    const server = mcpRegistry.get(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    // In a real implementation, this would spawn the MCP server process
    // For now, we track the connection state
    const connection: McpConnection = {
      serverId,
      connected: true,
      tools: server.tools
    };

    this.connections.set(serverId, connection);
    return connection;
  }

  async disconnect(serverId: string): Promise<void> {
    this.connections.delete(serverId);
  }

  getConnection(serverId: string): McpConnection | undefined {
    return this.connections.get(serverId);
  }

  getAvailableTools(): string[] {
    const tools: string[] = [];
    for (const conn of this.connections.values()) {
      if (conn.connected) {
        tools.push(...conn.tools);
      }
    }
    return tools;
  }

  getMcpCommandLine(serverIds: string[]): string {
    const configs = mcpRegistry.getCommandConfig(serverIds);
    return configs.map(c => `${c.command} ${c.args.join(' ')}`).join(' && ');
  }
}

export const mcpConnector = new McpConnector();
