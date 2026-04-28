export interface McpServerEntry {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  description: string;
  tools: string[];
}

export const BUILTIN_MCP_SERVERS: McpServerEntry[] = [
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
  private servers: Map<string, McpServerEntry> = new Map();

  constructor(initialServers: McpServerEntry[] = BUILTIN_MCP_SERVERS) {
    for (const server of initialServers) {
      this.register(server);
    }
  }

  register(server: McpServerEntry): void {
    this.servers.set(server.id, server);
  }

  get(id: string): McpServerEntry | undefined {
    return this.servers.get(id);
  }

  list(): McpServerEntry[] {
    return Array.from(this.servers.values());
  }

  getByTool(toolName: string): McpServerEntry[] {
    return Array.from(this.servers.values()).filter(s => s.tools.includes(toolName));
  }

  getCommandConfig(ids: string[]): { command: string; args: string[]; env?: Record<string, string> }[] {
    return ids
      .map(id => this.servers.get(id))
      .filter(Boolean)
      .map(s => ({ command: s!.command, args: s!.args, env: s!.env }));
  }
}

export const mcpRegistry = new McpRegistry();
