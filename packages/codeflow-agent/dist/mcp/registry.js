export const BUILTIN_MCP_SERVERS = [
    {
        id: 'claude-peers',
        name: 'Claude Peers',
        command: 'npx',
        args: ['-y', '@claude/peers'],
        description: 'Inter-agent communication and peer discovery',
        tools: ['list_peers', 'send_message', 'set_summary', 'check_messages']
    },
    {
        id: 'context7',
        name: 'Context7',
        command: 'npx',
        args: ['-y', '@context7/mcp'],
        description: 'Documentation retrieval for libraries and frameworks',
        tools: ['resolve-library-id', 'query-docs']
    },
    {
        id: 'serena',
        name: 'Serena',
        command: 'npx',
        args: ['-y', '@serena/serena'],
        description: 'Codebase intelligence and navigation',
        tools: ['find_symbol', 'search_for_pattern', 'read_file', 'rename_symbol']
    },
    {
        id: 'playwright',
        name: 'Playwright',
        command: 'npx',
        args: ['-y', '@playwright/mcp'],
        description: 'Browser automation and testing',
        tools: ['browser_navigate', 'browser_snapshot', 'browser_click', 'browser_type']
    },
    {
        id: 'github',
        name: 'GitHub',
        command: 'npx',
        args: ['-y', '@github/github-mcp'],
        description: 'GitHub API integration for PRs, issues, repos',
        tools: ['gh_prompt', 'gh_api']
    },
    {
        id: 'circleback',
        name: 'Circleback',
        command: 'npx',
        args: ['-y', '@circleback/mcp'],
        description: 'Meeting intelligence and calendar integration',
        tools: ['search_meetings', 'search_transcripts', 'search_emails', 'search_action_items']
    }
];
export class McpRegistry {
    servers = new Map();
    constructor(initialServers = BUILTIN_MCP_SERVERS) {
        for (const server of initialServers) {
            this.register(server);
        }
    }
    register(server) {
        this.servers.set(server.id, server);
    }
    get(id) {
        return this.servers.get(id);
    }
    list() {
        return Array.from(this.servers.values());
    }
    getByTool(toolName) {
        return Array.from(this.servers.values()).filter(s => s.tools.includes(toolName));
    }
    getCommandConfig(ids) {
        return ids
            .map(id => this.servers.get(id))
            .filter(Boolean)
            .map(s => ({ command: s.command, args: s.args, env: s.env }));
    }
}
export const mcpRegistry = new McpRegistry();
