export interface McpConnection {
    serverId: string;
    connected: boolean;
    tools: string[];
}
export declare class McpConnector {
    private connections;
    connect(serverId: string): Promise<McpConnection>;
    disconnect(serverId: string): Promise<void>;
    getConnection(serverId: string): McpConnection | undefined;
    getAvailableTools(): string[];
    getMcpCommandLine(serverIds: string[]): string;
}
export declare const mcpConnector: McpConnector;
//# sourceMappingURL=connector.d.ts.map