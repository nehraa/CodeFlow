export interface PluginEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  config?: Record<string, unknown>;
}

export const BUILTIN_PLUGINS: PluginEntry[] = [
  {
    id: 'superpowers',
    name: 'Superpowers',
    version: '5.0.7',
    description: 'Subagent-driven development, brainstorming, and execution skills',
    capabilities: [
      'subagent-driven-development',
      'executing-plans',
      'dispatching-parallel-agents',
      'brainstorming',
      'writing-plans'
    ]
  },
  {
    id: 'frontend-design',
    name: 'Frontend Design',
    version: 'latest',
    description: 'Modern web technologies and UI implementation',
    capabilities: ['react', 'tailwind', 'css', 'responsive-design']
  },
  {
    id: 'code-review',
    name: 'Code Review',
    version: 'latest',
    description: 'Comprehensive code review and quality assurance',
    capabilities: ['static-analysis', 'security', 'performance', 'style-guide']
  },
  {
    id: 'github',
    name: 'GitHub',
    version: 'latest',
    description: 'GitHub integration for PR and repository management',
    capabilities: ['pr-create', 'pr-review', 'issues', 'repo-management']
  },
  {
    id: 'context7',
    name: 'Context7',
    version: 'latest',
    description: 'Documentation retrieval for libraries and frameworks',
    capabilities: ['docs-fetch', 'api-reference', 'migration-guide']
  },
  {
    id: 'playwright',
    name: 'Playwright',
    version: 'latest',
    description: 'Browser automation and end-to-end testing',
    capabilities: ['browser-automation', 'e2e-testing', 'screenshot']
  }
];

export class PluginRegistry {
  private plugins: Map<string, PluginEntry> = new Map();

  constructor(initialPlugins: PluginEntry[] = BUILTIN_PLUGINS) {
    for (const plugin of initialPlugins) {
      this.register(plugin);
    }
  }

  register(plugin: PluginEntry): void {
    this.plugins.set(plugin.id, plugin);
  }

  get(id: string): PluginEntry | undefined {
    return this.plugins.get(id);
  }

  list(): PluginEntry[] {
    return Array.from(this.plugins.values());
  }

  findByCapability(capability: string): PluginEntry[] {
    return Array.from(this.plugins.values()).filter(p =>
      p.capabilities.includes(capability)
    );
  }

  getCapabilities(pluginId: string): string[] {
    const plugin = this.plugins.get(pluginId);
    return plugin?.capabilities ?? [];
  }
}

export const pluginRegistry = new PluginRegistry();
