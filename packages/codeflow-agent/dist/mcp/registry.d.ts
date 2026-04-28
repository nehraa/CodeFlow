export interface McpServerEntry {
    id: string;
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    description: string;
    tools: string[];
}
export declare const BUILTIN_MCP_SERVERS: McpServerEntry[];
export declare class McpRegistry {
    private servers;
    constructor(initialServers?: McpServerEntry[]);
    register(server: McpServerEntry): void;
    get(id: string): McpServerEntry | undefined;
    list(): McpServerEntry[];
    getByTool(toolName: string): McpServerEntry[];
    getCommandConfig(ids: string[]): {
        command: string;
        args: string[];
        env?: Record<string, string>;
    }[];
}
export declare const mcpRegistry: McpRegistry;
//# sourceMappingURL=registry.d.ts.map