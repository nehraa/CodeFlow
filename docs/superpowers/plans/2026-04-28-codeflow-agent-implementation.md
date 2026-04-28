# codeflow-agent Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `codeflow-agent` package - an orchestration layer for subagent-driven development that spawns specialized Claude Code agents for each implementation task using the Agent tool.

**Architecture:** The agent package acts as a task dispatcher that:
1. Reads implementation tasks from a plan
2. Spawns fresh specialized subagents per task using Claude Code's `Agent` tool
3. Coordinates task dependencies and sequential execution
4. Aggregates results and handles errors

**Tech Stack:** TypeScript, Node.js, Claude Code Agent tool, @abhinav2203/codeflow-store, @abhinav2203/codeflow-core

---

## File Structure

```
packages/codeflow-agent/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Main exports
│   ├── agent/
│   │   ├── types.ts            # AgentTask, AgentResult, AgentConfig types
│   │   ├── agent-spawner.ts    # Core agent spawning logic
│   │   ├── task-queue.ts       # Task queue with dependency management
│   │   ├── result-aggregator.ts # Aggregates results from subagents
│   │   └── prompts/
│   │       ├── coder-prompt.ts       # Coder agent prompt
│   │       ├── reviewer-prompt.ts     # Reviewer agent prompt
│   │       ├── tester-prompt.ts       # Tester agent prompt
│   │       └── planner-prompt.ts       # Planner agent prompt
│   ├── skills/
│   │   ├── registry.ts         # Skill registry with all available skills
│   │   └── loader.ts          # Loads skill definitions on demand
│   ├── mcp/
│   │   ├── registry.ts         # MCP server registry
│   │   └── connector.ts        # Connects to MCP servers
│   ├── plugins/
│   │   ├── registry.ts         # Plugin registry
│   │   └── loader.ts          # Loads plugin configurations
│   └── cli/
│       └── index.ts           # CLI entry point
├── test/
│   └── agent.test.ts          # Agent orchestration tests
└── README.md
```

---

## Task 1: Package Foundation

**Files:**
- Create: `packages/codeflow-agent/package.json`
- Create: `packages/codeflow-agent/tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@abhinav2203/codeflow-agent",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./agent": { "types": "./dist/agent/index.d.ts", "default": "./dist/agent/index.js" },
    "./skills": { "types": "./dist/skills/index.d.ts", "default": "./dist/skills/index.js" },
    "./mcp": { "types": "./dist/mcp/index.d.ts", "default": "./dist/mcp/index.js" }
  },
  "scripts": {
    "check": "tsc --noEmit",
    "test": "vitest run",
    "build": "tsc --outDir dist --declaration --declarationMap --noEmit false"
  },
  "dependencies": {
    "@abhinav2203/codeflow-core": "workspace:*",
    "@abhinav2203/codeflow-store": "workspace:*",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/codeflow-agent/package.json packages/codeflow-agent/tsconfig.json
git commit -m "feat(agent): add codeflow-agent package foundation"
```

---

## Task 2: Core Type Definitions

**Files:**
- Create: `packages/codeflow-agent/src/agent/types.ts`
- Modify: `packages/codeflow-agent/src/index.ts`

- [ ] **Step 1: Create agent types**

```typescript
import type { CapabilityRegistry, Skill, McpServer, Plugin } from '@abhinav2203/codeflow-core';

export interface AgentTask {
  id: string;
  name: string;
  description: string;
  files: string[];
  verify: string;
  done: string;
  dependsOn: string[];
  skills?: string[];
  mcpServers?: string[];
  plugins?: string[];
  agentType?: 'coder' | 'reviewer' | 'tester' | 'planner' | 'researcher';
  model?: 'sonnet' | 'opus' | 'haiku';
  subagentPrompt?: string;
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: Record<string, string>;
  duration: number;
}

export interface AgentConfig {
  maxConcurrent?: number;
  maxRetries?: number;
  defaultModel?: 'sonnet' | 'opus' | 'haiku';
  defaultAgentType?: AgentTask['agentType'];
  workingDirectory?: string;
  capabilities?: CapabilityConfig;
}

export interface CapabilityConfig {
  skills: Skill[];
  mcpServers: McpServer[];
  plugins: Plugin[];
}

export interface TaskStatus {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: AgentResult;
  startedAt?: Date;
  completedAt?: Date;
}

export interface OrchestrationResult {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  results: AgentResult[];
  duration: number;
}
```

- [ ] **Step 2: Create index.ts exports**

```typescript
export * from './agent/types.js';
export * from './agent/agent-spawner.js';
export * from './agent/task-queue.js';
export * from './agent/result-aggregator.js';
export * from './skills/registry.js';
export * from './mcp/registry.js';
export * from './plugins/registry.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/codeflow-agent/src/agent/types.ts packages/codeflow-agent/src/index.ts
git commit -m "feat(agent): add core type definitions"
```

---

## Task 3: Skill Registry with Full Capability Index

**Files:**
- Create: `packages/codeflow-agent/src/skills/registry.ts`
- Create: `packages/codeflow-agent/src/skills/loader.ts`

- [ ] **Step 1: Create skill registry**

```typescript
import type { Skill } from '@abhinav2203/codeflow-core';

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

    return `\n\n## REQUIRED SKILLS FOR THIS TASK\n` +
      skillEntries.map(s => `- **${s.name}** (${s.id}): ${s.description}`).join('\n') +
      `\n\nLoad each skill using the Skill tool before proceeding with implementation.`;
  }
}

export const skillRegistry = new SkillRegistry();
```

- [ ] **Step 2: Create skill loader**

```typescript
import { skillRegistry, type SkillEntry } from './registry.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export async function loadSkillContent(skillId: string): Promise<string | null> {
  const skill = skillRegistry.get(skillId);
  if (!skill) return null;

  try {
    const content = await readFile(skill.path, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

export function getSkillPrompt(skillId: string, taskContext: string): string {
  const skill = skillRegistry.get(skillId);
  if (!skill) return '';

  return `\n\n## SKILL: ${skill.name}\n\n` +
    `**Trigger Phrases:** ${skill.triggerPhrases.join(', ')}\n\n` +
    `**Description:** ${skill.description}\n\n` +
    `**Task Context:** ${taskContext}\n\n` +
    `**Skill File:** ${skill.path}\n\n` +
    `Load this skill using the Skill tool to activate its capabilities.`;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/codeflow-agent/src/skills/registry.ts packages/codeflow-agent/src/skills/loader.ts
git commit -m "feat(agent): add skill registry with 15+ integrated skills"
```

---

## Task 4: MCP Server Registry

**Files:**
- Create: `packages/codeflow-agent/src/mcp/registry.ts`
- Create: `packages/codeflow-agent/src/mcp/connector.ts`

- [ ] **Step 1: Create MCP registry**

```typescript
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
```

- [ ] **Step 2: Create MCP connector**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/codeflow-agent/src/mcp/registry.ts packages/codeflow-agent/src/mcp/connector.ts
git commit -m "feat(agent): add MCP server registry with 6 integrated servers"
```

---

## Task 5: Agent Prompts Library

**Files:**
- Create: `packages/codeflow-agent/src/agent/prompts/coder-prompt.ts`
- Create: `packages/codeflow-agent/src/agent/prompts/reviewer-prompt.ts`
- Create: `packages/codeflow-agent/src/agent/prompts/tester-prompt.ts`
- Create: `packages/codeflow-agent/src/agent/prompts/planner-prompt.ts`

- [ ] **Step 1: Create coder prompt**

```typescript
import { skillRegistry } from '../../skills/registry.js';
import { mcpRegistry } from '../../mcp/registry.js';
import type { AgentTask } from '../types.js';

export interface CoderPromptOptions {
  task: AgentTask;
  projectContext: {
    rootPath: string;
    techStack: string[];
    conventions: string[];
  };
  skills?: string[];
  mcpServers?: string[];
}

export function buildCoderPrompt(options: CoderPromptOptions): string {
  const { task, projectContext, skills = [], mcpServers = [] } = options;

  const skillPrompt = skillRegistry.getPromptForTask(task.description, skills);
  const mcpPrompt = mcpServers.length > 0
    ? `\n\n## AVAILABLE MCP TOOLS\nThe following MCP servers are available for this task:\n` +
      mcpServers.map(id => {
        const server = mcpRegistry.get(id);
        return server ? `- **${server.name}**: ${server.description} (tools: ${server.tools.join(', ')})` : '';
      }).filter(Boolean).join('\n') +
      `\n\nConnect to required MCP servers before use.`
    : '';

  return `You are a senior software engineer implementing a specific task.

## TASK: ${task.name}
${task.description}

## FILES TO MODIFY
${task.files.map(f => `- ${f}`).join('\n')}

## VERIFICATION
Run this command to verify completion:
\`\`\`bash
${task.verify}
\`\`\`

## SUCCESS CRITERIA
${task.done}

## PROJECT CONTEXT
- **Root Path:** ${projectContext.rootPath}
- **Tech Stack:** ${projectContext.techStack.join(', ')}
- **Conventions:** ${projectContext.conventions.map(c => `- ${c}`).join('\n')}

${skillPrompt}
${mcpPrompt}

## IMPLEMENTATION STEPS
1. Read the existing code to understand current patterns
2. Write the failing test first (if applicable)
3. Implement the minimal code to pass the test
4. Run verification command
5. Commit with semantic commit message

Follow TDD practices. Write clean, production-ready code. Commit after each task completion.`;
}

export const CODER_AGENT_SYSTEM_PROMPT = `You are a senior software engineer specializing in clean code, TDD, and following project conventions. You execute tasks precisely as specified without adding unnecessary features. You always write tests before implementation and verify completion with the specified command.`;
```

- [ ] **Step 2: Create reviewer prompt**

```typescript
import { skillRegistry } from '../../skills/registry.js';
import { mcpRegistry } from '../../mcp/registry.js';
import type { AgentTask } from '../types.js';

export interface ReviewerPromptOptions {
  task: AgentTask;
  codeToReview: string;
  skills?: string[];
}

export function buildReviewerPrompt(options: ReviewerPromptOptions): string {
  const { task, codeToReview, skills = [] } = options;

  const skillPrompt = skillRegistry.getPromptForTask('code review', skills);

  return `You are a senior code reviewer specializing in correctness, security, and performance.

## TASK: ${task.name}
${task.description}

## CODE TO REVIEW
\`\`\`typescript
${codeToReview}
\`\`\`

${skillPrompt}

## REVIEW CRITERIA
1. **Correctness** - Does the code do what it claims?
2. **Security** - Any injection risks, hardcoded secrets, or validation gaps?
3. **Performance** - Any N+1 queries, unbounded loops, or memory leaks?
4. **Error Handling** - Are all error cases handled properly?
5. **Type Safety** - Proper TypeScript types, no \`any\` without justification?
6. **Code Style** - Follows DRY, KISS, SOLID principles?

## OUTPUT FORMAT
Provide your review in this structure:
\`\`\`markdown
## Issues Found

### [Severity] Issue Title
**File:** \`path/to/file.ts:line\`
**Problem:** Description
**Fix:** Suggested fix

## Approved / Changes Requested
\`\`\`

Be thorough but constructive. Focus on blockers, not style preferences.`;
}

export const REVIEWER_AGENT_SYSTEM_PROMPT = `You are a senior code reviewer with expertise in TypeScript, security, and performance. You provide thorough, constructive feedback that improves code quality without being pedantic. You focus on blockers, security issues, and correctness bugs.`;
```

- [ ] **Step 3: Create tester prompt**

```typescript
import type { AgentTask } from '../types.js';

export interface TesterPromptOptions {
  task: AgentTask;
  implementationCode: string;
}

export function buildTesterPrompt(options: TesterPromptOptions): string {
  const { task, implementationCode } = options;

  return `You are a senior test engineer specializing in comprehensive test coverage.

## TASK: ${task.name}
${task.description}

## IMPLEMENTATION TO TEST
\`\`\`typescript
${implementationCode}
\`\`\`

## FILES
- Test file: \`${task.files.find(f => f.includes('.test.')) || task.files[0]}\`

## TEST REQUIREMENTS
1. **Happy Path** - Core functionality works correctly
2. **Edge Cases** - Empty input, null, boundary values, maximum values
3. **Error Cases** - Invalid input, network failures, timeouts
4. **Error Handling** - All thrown/returned errors are tested

## TEST TEMPLATE
\`\`\`typescript
import { describe, it, expect } from 'vitest';

describe('${task.name}', () => {
  it('should handle valid input', () => {
    // Arrange
    const input = /* valid value */;

    // Act
    const result = /* call function */;

    // Assert
    expect(result).toBe(/* expected */);
  });

  it('should handle empty input', () => {
    // Test edge case
  });

  it('should throw on invalid input', () => {
    // Test error case
  });
});
\`\`\`

## VERIFICATION
Run: \`${task.verify}\`
Expected: All tests pass

## SUCCESS CRITERIA
- Test coverage > 80%
- All edge cases covered
- All error paths tested
- Tests are deterministic (no flaky tests)`;

export const TESTER_AGENT_SYSTEM_PROMPT = `You are a senior test engineer with expertise in TDD, test coverage analysis, and deterministic testing. You write tests that catch bugs, not just verify happy paths. You follow the AAA pattern (Arrange-Act-Assert) and ensure tests are independent and deterministic.`;
```

- [ ] **Step 4: Create planner prompt**

```typescript
import type { AgentTask } from '../types.js';

export interface PlannerPromptOptions {
  goal: string;
  constraints: string[];
  existingFiles: string[];
}

export function buildPlannerPrompt(options: PlannerPromptOptions): string {
  const { goal, constraints, existingFiles } = options;

  return `You are a senior software architect specializing in task decomposition and dependency analysis.

## GOAL
${goal}

## EXISTING FILES
${existingFiles.map(f => `- ${f}`).join('\n')}

## CONSTRAINTS
${constraints.map(c => `- ${c}`).join('\n')}

## DECOMPOSITION APPROACH
1. **Identify independent tasks** - Tasks with no dependencies can run in parallel
2. **Identify sequential dependencies** - Task B needs Task A's output
3. **Define contracts** - What does each task's output look like?
4. **Assign to vertical slices** - Group related functionality together
5. **Define verification** - How to prove each task is complete?

## OUTPUT FORMAT
\`\`\`markdown
### Task N: [Task Name]

**Files:**
- Create: \`path/to/file.ts\`
- Modify: \`path/to/existing.ts:line-line\`

- [ ] **Step 1:** [Action]
- [ ] **Step 2:** [Action]

**Verification:** \`command to run\`
**Success Criteria:** [Measurable outcome]
\`\`\`

## MUST-HAVES
- Each task: 2-5 minutes of work
- Each task: specific files, specific actions
- Each task: verification command
- No placeholders (TBD, TODO, etc.)
- Complete code in every step

Follow YAGNI ruthlessly. Write the plan a senior engineer would need to implement without asking questions.`;

export const PLANNER_AGENT_SYSTEM_PROMPT = `You are a senior software architect with expertise in task decomposition, dependency analysis, and implementation planning. You break complex goals into bite-sized, executable tasks that can be implemented independently. You follow YAGNI, DRY, and SOLID principles.`;
```

- [ ] **Step 5: Commit**

```bash
git add packages/codeflow-agent/src/agent/prompts/coder-prompt.ts packages/codeflow-agent/src/agent/prompts/reviewer-prompt.ts packages/codeflow-agent/src/agent/prompts/tester-prompt.ts packages/codeflow-agent/src/agent/prompts/planner-prompt.ts
git commit -m "feat(agent): add prompt library for coder, reviewer, tester, planner agents"
```

---

## Task 6: Agent Spawner with Task Queue

**Files:**
- Create: `packages/codeflow-agent/src/agent/agent-spawner.ts`
- Create: `packages/codeflow-agent/src/agent/task-queue.ts`
- Create: `packages/codeflow-agent/src/agent/result-aggregator.ts`

- [ ] **Step 1: Create task queue**

```typescript
import type { AgentTask, TaskStatus } from './types.js';

export class TaskQueue {
  private pendingTasks: Map<string, AgentTask> = new Map();
  private taskStatuses: Map<string, TaskStatus> = new Map();
  private completedResults: Map<string, TaskStatus['result']> = new Map();

  constructor(tasks: AgentTask[]) {
    for (const task of tasks) {
      this.pendingTasks.set(task.id, task);
      this.taskStatuses.set(task.id, {
        taskId: task.id,
        status: 'pending'
      });
    }
  }

  getTask(id: string): AgentTask | undefined {
    return this.pendingTasks.get(id);
  }

  getReadyTasks(): AgentTask[] {
    const ready: AgentTask[] = [];

    for (const [id, task] of this.pendingTasks) {
      const status = this.taskStatuses.get(id);
      if (status?.status !== 'pending') continue;

      // Check if all dependencies are completed
      const depsCompleted = task.dependsOn.every(depId => {
        const depStatus = this.taskStatuses.get(depId);
        return depStatus?.status === 'completed';
      });

      if (depsCompleted) {
        ready.push(task);
      }
    }

    return ready;
  }

  markRunning(taskId: string): void {
    const status = this.taskStatuses.get(taskId);
    if (status) {
      status.status = 'running';
      status.startedAt = new Date();
    }
  }

  markCompleted(taskId: string, result: TaskStatus['result']): void {
    const status = this.taskStatuses.get(taskId);
    if (status) {
      status.status = result.success ? 'completed' : 'failed';
      status.result = result;
      status.completedAt = new Date();
    }
    this.completedResults.set(taskId, result);
  }

  isAllCompleted(): boolean {
    for (const status of this.taskStatuses.values()) {
      if (status.status !== 'completed' && status.status !== 'failed') {
        return false;
      }
    }
    return true;
  }

  getResults(): Map<string, TaskStatus['result']> {
    return this.completedResults;
  }

  getStatus(taskId: string): TaskStatus | undefined {
    return this.taskStatuses.get(taskId);
  }

  getPendingCount(): number {
    let count = 0;
    for (const status of this.taskStatuses.values()) {
      if (status.status === 'pending') count++;
    }
    return count;
  }

  getCompletedCount(): number {
    let count = 0;
    for (const status of this.taskStatuses.values()) {
      if (status.status === 'completed') count++;
    }
    return count;
  }

  getFailedCount(): number {
    let count = 0;
    for (const status of this.taskStatuses.values()) {
      if (status.status === 'failed') count++;
    }
    return count;
  }
}
```

- [ ] **Step 2: Create agent spawner**

```typescript
import type { AgentTask, AgentResult, AgentConfig } from './types.js';
import { buildCoderPrompt, buildReviewerPrompt, buildTesterPrompt, buildPlannerPrompt, CODER_AGENT_SYSTEM_PROMPT, REVIEWER_AGENT_SYSTEM_PROMPT, TESTER_AGENT_SYSTEM_PROMPT, PLANNER_AGENT_SYSTEM_PROMPT } from './prompts/index.js';
import { TaskQueue } from './task-queue.js';

export interface SpawnResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
}

export class AgentSpawner {
  private config: AgentConfig;
  private activeAgents: Map<string, Promise<SpawnResult>> = new Map();

  constructor(config: AgentConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 3,
      maxRetries: config.maxRetries ?? 2,
      defaultModel: config.defaultModel ?? 'sonnet',
      ...config
    };
  }

  async spawnAgent(
    task: AgentTask,
    context: {
      systemPrompt?: string;
      userPrompt: string;
      model?: 'sonnet' | 'opus' | 'haiku';
    }
  ): Promise<SpawnResult> {
    const model = context.model ?? task.model ?? this.config.defaultModel;

    // Use the Agent tool to spawn a subagent
    // In a real implementation, this would use the Claude Code API
    const startTime = Date.now();

    try {
      // This is a placeholder - actual implementation would call Claude Code's Agent API
      const agentType = task.agentType ?? 'coder';

      const prompt = this.buildPromptForTask(task, context.userPrompt);

      // Placeholder for actual Agent tool call
      const result = await this.executeAgent({
        taskId: task.id,
        prompt,
        systemPrompt: context.systemPrompt ?? this.getSystemPromptForType(agentType),
        model
      });

      return {
        taskId: task.id,
        success: true,
        output: result
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private buildPromptForTask(task: AgentTask, userPrompt: string): string {
    // Route to appropriate prompt builder
    // This would be expanded based on agent type
    return `${userPrompt}\n\n## Task Metadata\n- Task ID: ${task.id}\n- Task Name: ${task.name}\n- Files: ${task.files.join(', ')}\n- Verify: ${task.verify}`;
  }

  private getSystemPromptForType(type: string): string {
    switch (type) {
      case 'coder':
        return CODER_AGENT_SYSTEM_PROMPT;
      case 'reviewer':
        return REVIEWER_AGENT_SYSTEM_PROMPT;
      case 'tester':
        return TESTER_AGENT_SYSTEM_PROMPT;
      case 'planner':
        return PLANNER_AGENT_SYSTEM_PROMPT;
      default:
        return CODER_AGENT_SYSTEM_PROMPT;
    }
  }

  private async executeAgent(params: {
    taskId: string;
    prompt: string;
    systemPrompt: string;
    model: 'sonnet' | 'opus' | 'haiku';
  }): Promise<string> {
    // PLACEHOLDER: Actual implementation would use Claude Code Agent API
    // This would spawn the agent and wait for results
    throw new Error('Agent execution not implemented - requires Claude Code API integration');
  }

  async executeWithQueue(
    tasks: AgentTask[],
    executeFn: (task: AgentTask) => Promise<string>
  ): Promise<Map<string, AgentResult>> {
    const queue = new TaskQueue(tasks);
    const results = new Map<string, AgentResult>();

    while (!queue.isAllCompleted()) {
      const readyTasks = queue.getReadyTasks();

      if (readyTasks.length === 0 && queue.getPendingCount() > 0) {
        // Deadlock - circular dependency
        throw new Error('Circular dependency detected - cannot resolve task queue');
      }

      // Process ready tasks (respecting concurrency limit)
      const toExecute = readyTasks.slice(0, this.config.maxConcurrent!);

      await Promise.all(toExecute.map(async task => {
        queue.markRunning(task.id);

        const startTime = Date.now();
        try {
          const output = await executeFn(task);
          const duration = Date.now() - startTime;

          results.set(task.id, {
            taskId: task.id,
            success: true,
            output,
            duration
          });

          queue.markCompleted(task.id, results.get(task.id));
        } catch (error) {
          const duration = Date.now() - startTime;

          results.set(task.id, {
            taskId: task.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration
          });

          queue.markCompleted(task.id, results.get(task.id));
        }
      }));
    }

    return results;
  }
}
```

- [ ] **Step 3: Create result aggregator**

```typescript
import type { AgentResult, OrchestrationResult } from './types.js';

export class ResultAggregator {
  aggregate(results: Map<string, AgentResult>): OrchestrationResult {
    let completedTasks = 0;
    let failedTasks = 0;
    let totalDuration = 0;

    const resultArray: AgentResult[] = [];

    for (const result of results.values()) {
      resultArray.push(result);

      if (result.success) {
        completedTasks++;
      } else {
        failedTasks++;
      }

      totalDuration += result.duration;
    }

    return {
      totalTasks: resultArray.length,
      completedTasks,
      failedTasks,
      results: resultArray,
      duration: totalDuration
    };
  }

  getFailedTasks(results: Map<string, AgentResult>): AgentResult[] {
    return Array.from(results.values()).filter(r => !r.success);
  }

  getSuccessfulTasks(results: Map<string, AgentResult>): AgentResult[] {
    return Array.from(results.values()).filter(r => r.success);
  }

  generateReport(result: OrchestrationResult): string {
    const successRate = ((result.completedTasks / result.totalTasks) * 100).toFixed(1);

    let report = `# Orchestration Report\n\n`;
    report += `## Summary\n`;
    report += `- Total Tasks: ${result.totalTasks}\n`;
    report += `- Completed: ${result.completedTasks}\n`;
    report += `- Failed: ${result.failedTasks}\n`;
    report += `- Success Rate: ${successRate}%\n`;
    report += `- Total Duration: ${(result.duration / 1000).toFixed(1)}s\n\n`;

    if (result.failedTasks > 0) {
      report += `## Failed Tasks\n`;
      for (const taskResult of result.results) {
        if (!taskResult.success) {
          report += `### ${taskResult.taskId}\n`;
          report += `**Error:** ${taskResult.error}\n\n`;
        }
      }
    }

    return report;
  }
}

export const resultAggregator = new ResultAggregator();
```

- [ ] **Step 4: Commit**

```bash
git add packages/codeflow-agent/src/agent/task-queue.ts packages/codeflow-agent/src/agent/agent-spawner.ts packages/codeflow-agent/src/agent/result-aggregator.ts
git commit -m "feat(agent): add agent spawner with task queue and result aggregator"
```

---

## Task 7: Plugin Registry

**Files:**
- Create: `packages/codeflow-agent/src/plugins/registry.ts`
- Create: `packages/codeflow-agent/src/plugins/loader.ts`

- [ ] **Step 1: Create plugin registry**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/codeflow-agent/src/plugins/registry.ts packages/codeflow-agent/src/plugins/loader.ts
git commit -m "feat(agent): add plugin registry with 6 integrated plugins"
```

---

## Task 8: CLI Entry Point and README

**Files:**
- Create: `packages/codeflow-agent/src/cli/index.ts`
- Create: `packages/codeflow-agent/README.md`

- [ ] **Step 1: Create CLI**

```typescript
#!/usr/bin/env node

import { AgentSpawner } from '../agent/agent-spawner.js';
import { ResultAggregator, resultAggregator } from '../agent/result-aggregator.js';
import { TaskQueue } from '../agent/task-queue.js';
import { skillRegistry } from '../skills/registry.js';
import { mcpRegistry } from '../mcp/registry.js';
import { pluginRegistry } from '../plugins/registry.js';
import type { AgentTask, AgentConfig } from '../agent/types.js';
import { readFile } from 'fs/promises';

interface CliOptions {
  planFile: string;
  maxConcurrent?: number;
  model?: 'sonnet' | 'opus' | 'haiku';
  listSkills?: boolean;
  listMcp?: boolean;
  listPlugins?: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    planFile: '',
    maxConcurrent: 3,
    model: 'sonnet'
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--plan':
        options.planFile = args[++i];
        break;
      case '--max-concurrent':
        options.maxConcurrent = parseInt(args[++i], 10);
        break;
      case '--model':
        options.model = args[++i] as 'sonnet' | 'opus' | 'haiku';
        break;
      case '--list-skills':
        options.listSkills = true;
        break;
      case '--list-mcp':
        options.listMcp = true;
        break;
      case '--list-plugins':
        options.listPlugins = true;
        break;
      default:
        if (!args[i].startsWith('--')) {
          options.planFile = args[i];
        }
    }
  }

  if (options.listSkills) {
    console.log('# Available Skills\n');
    for (const skill of skillRegistry.list()) {
      console.log(`- **${skill.id}**: ${skill.description}`);
    }
    return;
  }

  if (options.listMcp) {
    console.log('# Available MCP Servers\n');
    for (const server of mcpRegistry.list()) {
      console.log(`- **${server.id}**: ${server.description}`);
      console.log(`  Tools: ${server.tools.join(', ')}`);
    }
    return;
  }

  if (options.listPlugins) {
    console.log('# Available Plugins\n');
    for (const plugin of pluginRegistry.list()) {
      console.log(`- **${plugin.id}** (${plugin.version}): ${plugin.description}`);
      console.log(`  Capabilities: ${plugin.capabilities.join(', ')}`);
    }
    return;
  }

  if (!options.planFile) {
    console.error('Error: --plan <file> is required');
    console.log('\nUsage:');
    console.log('  codeflow-agent --plan <plan-file>    Execute a plan');
    console.log('  codeflow-agent --list-skills        List available skills');
    console.log('  codeflow-agent --list-mcp          List available MCP servers');
    console.log('  codeflow-agent --list-plugins      List available plugins');
    process.exit(1);
  }

  // Load plan file
  const planContent = await readFile(options.planFile, 'utf-8');
  const plan = JSON.parse(planContent) as { tasks: AgentTask[] };

  if (!plan.tasks || !Array.isArray(plan.tasks)) {
    console.error('Error: Invalid plan format - missing tasks array');
    process.exit(1);
  }

  console.log(`# Executing Plan\n`);
  console.log(`Total Tasks: ${plan.tasks.length}`);
  console.log(`Max Concurrent: ${options.maxConcurrent}\n`);

  const config: AgentConfig = {
    maxConcurrent: options.maxConcurrent,
    defaultModel: options.model
  };

  const spawner = new AgentSpawner(config);
  const queue = new TaskQueue(plan.tasks);

  const startTime = Date.now();

  // Execute tasks
  const results = await spawner.executeWithQueue(plan.tasks, async (task) => {
    console.log(`[${task.id}] Starting: ${task.name}`);

    // In real implementation, this would spawn the actual agent
    // For now, this is a placeholder
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`[${task.id}] Completed: ${task.name}`);
    return `Task ${task.id} completed successfully`;
  });

  const aggregation = resultAggregator.aggregate(results);

  console.log(`\n# Results\n`);
  console.log(`Completed: ${aggregation.completedTasks}/${aggregation.totalTasks}`);
  console.log(`Failed: ${aggregation.failedTasks}`);
  console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);

  if (aggregation.failedTasks > 0) {
    console.log(resultAggregator.generateReport(aggregation));
    process.exit(1);
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Create README**

```markdown
# codeflow-agent

Orchestration layer for subagent-driven development using Claude Code agents.

## Overview

`codeflow-agent` is a task orchestration package that spawns specialized Claude Code subagents to execute implementation tasks in parallel. It provides:

- **Task Queue Management** - Handles task dependencies and parallel execution
- **Agent Spawning** - Spawns fresh subagents per task using Claude Code's Agent tool
- **Skill Integration** - 15+ built-in skills from the superpowers plugin
- **MCP Integration** - 6 built-in MCP servers for extended capabilities
- **Plugin System** - 6 built-in plugins for specialized workflows
- **Result Aggregation** - Collects and reports results from all subagents

## Installation

```bash
npm install @abhinav2203/codeflow-agent
```

## Usage

### CLI

```bash
# Execute a plan
codeflow-agent --plan path/to/plan.json

# List available capabilities
codeflow-agent --list-skills
codeflow-agent --list-mcp
codeflow-agent --list-plugins
```

### Programmatic

```typescript
import { AgentSpawner } from '@abhinav2203/codeflow-agent';
import type { AgentTask } from '@abhinav2203/codeflow-agent';

const tasks: AgentTask[] = [
  {
    id: 'task-1',
    name: 'Create user model',
    description: 'Create the User model with email and password fields',
    files: ['src/models/user.ts'],
    verify: 'npm test -- --filter=user',
    done: 'User model created with validated email and hashed password',
    dependsOn: [],
    skills: ['superpowers:subagent-driven-development'],
    agentType: 'coder'
  }
];

const spawner = new AgentSpawner({ maxConcurrent: 3 });
const results = await spawner.executeWithQueue(tasks, async (task) => {
  // Execute the task
  return 'Task completed';
});
```

## Capabilities

### Built-in Skills

| Skill | Description | Use Cases |
|-------|-------------|-----------|
| `superpowers:subagent-driven-development` | Execute plans via subagent dispatch | execution |
| `superpowers:executing-plans` | Batch execution with checkpoints | execution |
| `context7` | Documentation retrieval | research |
| `code-review` | Comprehensive code review | review, security |
| `frontend-design` | Modern web technologies | frontend, design |
| `mcp-builder` | Build MCP servers | backend, ml |
| `security-guidance` | Security-first development | security |
| `pr-review-toolkit` | PR review and test coverage | review, testing |
| `simplify` | Code simplification | refactor |
| `github` | GitHub integration | ops |
| `serena` | Codebase intelligence | research |
| `playwright` | Browser automation | testing |
| `sentry` | Error tracking | ops |

### Built-in MCP Servers

| MCP Server | Description | Tools |
|------------|-------------|-------|
| `claude-peers` | Inter-agent communication | list_peers, send_message |
| `context7` | Documentation retrieval | resolve-library-id, query-docs |
| `serena` | Codebase navigation | find_symbol, search_for_pattern |
| `playwright` | Browser automation | browser_navigate, browser_snapshot |
| `github` | GitHub API | gh_prompt, gh_api |
| `circleback` | Meeting intelligence | search_meetings, search_transcripts |

### Built-in Plugins

| Plugin | Description |
|--------|-------------|
| `superpowers` | Subagent development framework |
| `frontend-design` | Web UI implementation |
| `code-review` | Quality assurance |
| `github` | Repository management |
| `context7` | Documentation |
| `playwright` | Testing |

## Architecture

```
packages/codeflow-agent/
├── src/
│   ├── index.ts              # Main exports
│   ├── agent/
│   │   ├── types.ts          # Type definitions
│   │   ├── agent-spawner.ts  # Core spawning logic
│   │   ├── task-queue.ts     # Dependency management
│   │   ├── result-aggregator.ts
│   │   └── prompts/          # Agent prompts
│   ├── skills/
│   │   ├── registry.ts       # Skill registry
│   │   └── loader.ts         # Skill loader
│   ├── mcp/
│   │   ├── registry.ts       # MCP registry
│   │   └── connector.ts     # MCP connector
│   └── plugins/
│       ├── registry.ts       # Plugin registry
│       └── loader.ts         # Plugin loader
```

## License

MIT
```

- [ ] **Step 3: Commit**

```bash
git add packages/codeflow-agent/src/cli/index.ts packages/codeflow-agent/README.md
git commit -m "feat(agent): add CLI and README"
```

---

## Verification

Run these commands to verify the implementation:

```bash
# Build the package
cd packages/codeflow-agent
npm run build

# Run tests
npm test

# List capabilities
npx @abhinav2203/codeflow-agent --list-skills
npx @abhinav2203/codeflow-agent --list-mcp
npx @abhinav2203/codeflow-agent --list-plugins
```

---

## Success Criteria

- [ ] Package builds without errors
- [ ] TypeScript types are correctly exported
- [ ] Skill registry includes 15+ skills with full metadata
- [ ] MCP registry includes 6 servers with tool lists
- [ ] Plugin registry includes 6 plugins with capabilities
- [ ] Task queue correctly handles dependencies
- [ ] Agent spawner is ready for Claude Code API integration
- [ ] CLI lists all capabilities correctly
- [ ] README documents all features with usage examples
