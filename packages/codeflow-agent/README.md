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
