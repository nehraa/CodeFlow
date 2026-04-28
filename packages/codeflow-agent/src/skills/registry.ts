export interface SkillEntry {
  id: string;
  name: string;
  path: string;
  triggerPhrases: string[];
  description: string;
  useCases: string[];
}

export const BUILTIN_SKILLS: SkillEntry[] = [
  {
    id: 'superpowers:subagent-driven-development',
    name: 'Subagent Driven Development',
    path: '/Users/abhinavnehra/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/subagent-driven-development/SKILL.md',
    triggerPhrases: ['subagent driven', 'spawn agents', 'agent orchestration'],
    description: 'Execute implementation plans with independent tasks via subagent dispatch',
    useCases: ['productivity', 'execution']
  },
  {
    id: 'superpowers:executing-plans',
    name: 'Executing Plans',
    path: '/Users/abhinavnehra/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/executing-plans/SKILL.md',
    triggerPhrases: ['execute plan', 'run tasks', 'batch execution'],
    description: 'Batch execution of planned tasks with checkpoints',
    useCases: ['productivity', 'execution']
  },
  {
    id: 'superpowers:brainstorming',
    name: 'Brainstorming',
    path: '/Users/abhinavnehra/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/brainstorming/SKILL.md',
    triggerPhrases: ['brainstorm', 'design', 'plan'],
    description: 'Turn ideas into fully formed designs and specs',
    useCases: ['planning', 'design']
  },
  {
    id: 'superpowers:writing-plans',
    name: 'Writing Plans',
    path: '/Users/abhinavnehra/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/writing-plans/SKILL.md',
    triggerPhrases: ['write plan', 'implementation plan', 'break down'],
    description: 'Write comprehensive implementation plans with bite-sized tasks',
    useCases: ['planning', 'documentation']
  },
  {
    id: 'context7',
    name: 'Context7 Documentation',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/context7-claude-plugins-official.md',
    triggerPhrases: ['context7', 'library docs', 'api documentation'],
    description: 'Fetch current documentation for libraries and frameworks',
    useCases: ['research', 'documentation']
  },
  {
    id: 'code-review',
    name: 'Code Review',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/code-review-claude-plugins-official.md',
    triggerPhrases: ['code review', 'review code', 'static analysis'],
    description: 'Comprehensive code review for correctness, security, and performance',
    useCases: ['review', 'security']
  },
  {
    id: 'frontend-design',
    name: 'Frontend Design',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/frontend-design-claude-plugins-official.md',
    triggerPhrases: ['frontend', 'ui design', 'react', 'tailwind'],
    description: 'Modern web technologies, React/Vue/Angular, UI implementation',
    useCases: ['frontend', 'design']
  },
  {
    id: 'mcp-builder',
    name: 'MCP Builder',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/agency-agents/mcp-builder.md',
    triggerPhrases: ['mcp', 'model context protocol', 'build mcp server'],
    description: 'Build MCP servers that extend AI agent capabilities',
    useCases: ['backend', 'ml']
  },
  {
    id: 'security-guidance',
    name: 'Security Guidance',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/security-guidance-claude-plugins-official.md',
    triggerPhrases: ['security', 'vulnerability', 'audit'],
    description: 'Security-first development practices and vulnerability detection',
    useCases: ['security', 'review']
  },
  {
    id: 'pr-review-toolkit',
    name: 'PR Review Toolkit',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/pr-review-toolkit-claude-plugins-official.md',
    triggerPhrases: ['pr review', 'pull request', 'merge'],
    description: 'Proactive code review for style, silent failures, and test coverage',
    useCases: ['review', 'testing']
  },
  {
    id: 'simplify',
    name: 'Code Simplifier',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/code-simplifier-claude-plugins-official.md',
    triggerPhrases: ['simplify', 'refactor', 'clean up'],
    description: 'Refine code for clarity, consistency, and maintainability',
    useCases: ['refactor', 'quality']
  },
  {
    id: 'github',
    name: 'GitHub Integration',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/github-claude-plugins-official.md',
    triggerPhrases: ['github', 'pr', 'repo', 'git'],
    description: 'GitHub PR, issues, and repository management',
    useCases: ['ops', 'productivity']
  },
  {
    id: 'serena',
    name: 'Serena Codebase Intelligence',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/serena-claude-plugins-official.md',
    triggerPhrases: ['serena', 'codebase search', 'symbols'],
    description: 'Codebase navigation, symbol search, and refactoring',
    useCases: ['research', 'navigation']
  },
  {
    id: 'playwright',
    name: 'Playwright Browser Automation',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/playwright-claude-plugins-official.md',
    triggerPhrases: ['playwright', 'browser', 'e2e', 'testing'],
    description: 'Browser automation and end-to-end testing',
    useCases: ['testing', 'frontend']
  },
  {
    id: 'sentry',
    name: 'Sentry Error Tracking',
    path: '/Users/abhinavnehra/Documents/Claude/Capabilities/skills/sentry-claude-plugins-official.md',
    triggerPhrases: ['sentry', 'error tracking', 'monitoring'],
    description: 'Error tracking and application monitoring',
    useCases: ['ops', 'monitoring']
  }
];

export class SkillRegistry {
  private skills: Map<string, SkillEntry> = new Map();
  private triggerIndex: Map<string, string[]> = new Map();

  constructor(initialSkills: SkillEntry[] = BUILTIN_SKILLS) {
    for (const skill of initialSkills) {
      this.register(skill);
    }
  }

  register(skill: SkillEntry): void {
    this.skills.set(skill.id, skill);
    for (const phrase of skill.triggerPhrases) {
      const existing = this.triggerIndex.get(phrase) || [];
      existing.push(skill.id);
      this.triggerIndex.set(phrase, existing);
    }
  }

  get(id: string): SkillEntry | undefined {
    return this.skills.get(id);
  }

  findByTrigger(trigger: string): SkillEntry[] {
    const ids = this.triggerIndex.get(trigger) || [];
    return ids.map(id => this.skills.get(id)).filter(Boolean) as SkillEntry[];
  }

  findByUseCase(useCase: string): SkillEntry[] {
    return Array.from(this.skills.values()).filter(s => s.useCases.includes(useCase));
  }

  list(): SkillEntry[] {
    return Array.from(this.skills.values());
  }

  getPromptForTask(taskDescription: string, requiredSkills: string[]): string {
    const skillEntries = requiredSkills
      .map(id => this.skills.get(id))
      .filter(Boolean) as SkillEntry[];

    if (skillEntries.length === 0) return '';

    return '\n\n## REQUIRED SKILLS FOR THIS TASK\n' +
      skillEntries.map(s => `- **${s.name}** (${s.id}): ${s.description}`).join('\n') +
      '\n\nLoad each skill using the Skill tool before proceeding with implementation.';
  }
}

export const skillRegistry = new SkillRegistry();
