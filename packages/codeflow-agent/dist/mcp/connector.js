import { mcpRegistry } from './registry.js';
export class McpConnector {
    connections = new Map();
    async connect(serverId) {
        const server = mcpRegistry.get(serverId);
        if (!server) {
            throw new Error(`MCP server ${serverId} not found`);
        }
        // In a real implementation, this would spawn the MCP server process
        // For now, we track the connection state
        const connection = {
            serverId,
            connected: true,
            tools: server.tools
        };
        this.connections.set(serverId, connection);
        return connection;
    }
    async disconnect(serverId) {
        this.connections.delete(serverId);
    }
    getConnection(serverId) {
        return this.connections.get(serverId);
    }
    getAvailableTools() {
        const tools = [];
        for (const conn of this.connections.values()) {
            if (conn.connected) {
                tools.push(...conn.tools);
            }
        }
        return tools;
    }
    getMcpCommandLine(serverIds) {
        const configs = mcpRegistry.getCommandConfig(serverIds);
        return configs.map(c => `${c.command} ${c.args.join(' ')}`).join(' && ');
    }
}
export const mcpConnector = new McpConnector();
