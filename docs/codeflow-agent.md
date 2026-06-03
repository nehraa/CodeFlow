# codeflow-agent

Subagent-driven development orchestrator. Takes a DAG of `AgentTask`s, schedules them based on dependencies, and spawns a fresh Claude Code subagent per task via the `opencode` CLI. Pairs with the superpowers skill plugin, six built-in MCP servers, and six built-in plugins.

## What it owns

- **Task scheduler.** `TaskQueue` walks the `dependsOn[]` graph and returns ready tasks. Throws on cycles.
- **Agent spawner.** `AgentSpawner` shells out to `opencode run -- "<prompt>" --model <m> --session codeflow-<agentType>-<taskId>`. Five-minute default timeout.
- **Result aggregator.** `ResultAggregator` tallies completed/failed/duration, emits a markdown report.
- **Skill registry.** 15+ built-in skills. `SkillRegistry` with `register`, `get`, `list`, `findByTrigger`.
- **MCP registry.** 6 built-in servers (claude-peers, context7, serena, playwright, github, circleback). `McpRegistry` plus the connector and client.
- **Plugin registry.** 6 built-in plugins (superpowers, frontend-design, code-review, github, context7, playwright).
- **Capabilities lookup.** Skills, MCP servers, and plugins resolved by id and passed via env/prompt context to the spawned CLI.

## Public API

```typescript
import {
  AgentSpawner,
  type AgentTask,
  type AgentConfig,
  type OrchestrationResult,
} from '@abhinav2203/codeflow-agent';
```

The CLI (`codeflow-agent`) runs a plan JSON file end-to-end and prints the aggregated report.

Subpath exports expose each subsystem in isolation:

| Subpath | Module |
| --- | --- |
| `./agent` | `AgentSpawner`, `TaskQueue`, `ResultAggregator`, types. |
| `./skills` | `SkillRegistry`, `BUILTIN_SKILLS`. |
| `./mcp` | `McpRegistry`, `BUILTIN_MCP_SERVERS`, connector/client. |
| `./ai/scaffold-utils` | Scaffolding helpers. |
| `./ai/scaffold-generator` | Code scaffold generator. |
| `./ai/multi-language-codegen` | Multi-language code generation. |
| `./ai/test-generator` | Test generation. |
| `./ai/doc-generator` | Documentation generation. |
| `./ai/refactor-suggester` | Refactor suggestions. |

## The `AgentTask` shape

```typescript
type AgentTask = {
  id: string;
  name: string;
  description: string;
  files: string[];          // files the task will read/write
  verify: string;           // shell command to verify completion
  done: string;             // definition-of-done (used to evaluate verify output)
  dependsOn: string[];      // task ids that must complete first
  skills?: string[];        // skill ids the subagent should activate
  mcpServers?: string[];    // MCP server ids to attach
  plugins?: string[];       // plugin ids to attach
  agentType: 'coder' | 'reviewer' | 'tester' | 'planner' | 'researcher';
  model: 'sonnet' | 'opus' | 'haiku';
  subagentPrompt?: string;  // override the default prompt
};
```

The fields `verify` and `done` are how the orchestrator decides whether a task succeeded. The verify command is run after the spawned CLI exits; if the command output contains a substring matching `done`, the task is marked complete. Otherwise it retries up to `maxRetries` (default 2).

`★ Insight ─────────────────────────────────────`
`verify` and `done` are the agent's definition-of-done mechanism. They keep the orchestrator from having to understand the task itself: the subagent owns the work, the shell command owns the truth.
`─────────────────────────────────────────────────`

## The DAG scheduler

```typescript
import { TaskQueue } from '@abhinav2203/codeflow-agent/agent';

const queue = new TaskQueue(tasks);
queue.getReadyTasks();   // tasks whose deps are all completed
queue.markRunning(id);
queue.markCompleted(id);
queue.markFailed(id);
```

`getReadyTasks` returns the set of pending tasks whose `dependsOn[]` is a subset of the completed set. Tasks with no deps are ready immediately. The spawner runs ready tasks in parallel, capped at `maxConcurrent` (default 3).

Cycles throw. Resolve them by reordering `dependsOn` or splitting a task.

## `AgentSpawner`

```typescript
import { AgentSpawner } from '@abhinav2203/codeflow-agent/agent';

const spawner = new AgentSpawner({ maxConcurrent: 3, maxRetries: 2 });

const result = await spawner.executeWithQueue(tasks, async (task) => {
  // optional: do work the orchestrator owns
  return { ok: true };
});
```

`executeWithQueue` is the main entry point. For each task:

1. Resolve the skills, MCP servers, and plugins by id.
2. Build the prompt: default prompt + task fields + capability context.
3. Shell out to `opencode` with a per-task session id (`codeflow-<agentType>-<taskId>`).
4. Run the `verify` command after exit.
5. If the command output matches `done`, mark complete; else mark failed (or retry).

The default `opencode` invocation looks like:

```bash
opencode run -- "<prompt>" --model <m> --session codeflow-coder-task-1
```

The session id makes the run visible in `opencode`'s own session log.

## Built-in skills

| Skill id | Description |
| --- | --- |
| `superpowers:subagent-driven-development` | Execute plans via subagent dispatch. |
| `superpowers:executing-plans` | Batch execution with checkpoints. |
| `superpowers:brainstorming` | Idea exploration before coding. |
| `superpowers:writing-plans` | Plan authoring. |
| `context7` | Documentation retrieval. |
| `code-review` | Comprehensive code review. |
| `frontend-design` | Modern web technologies. |
| `mcp-builder` | Build MCP servers. |
| `security-guidance` | Security-first development. |
| `pr-review-toolkit` | PR review and test coverage. |
| `simplify` | Code simplification. |
| `github` | GitHub integration. |
| `serena` | Codebase intelligence. |
| `playwright` | Browser automation. |
| `sentry` | Error tracking. |

`SkillRegistry.findByTrigger(phrase)` matches a phrase against the registered `triggerPhrases[]` so a planner can pick a skill based on the task description.

## Built-in MCP servers

| Server id | Description | Tools |
| --- | --- | --- |
| `claude-peers` | Inter-agent communication | `list_peers`, `send_message` |
| `context7` | Documentation retrieval | `resolve-library-id`, `query-docs` |
| `serena` | Codebase navigation | `find_symbol`, `search_for_pattern` |
| `playwright` | Browser automation | `browser_navigate`, `browser_snapshot` |
| `github` | GitHub API | `gh_prompt`, `gh_api` |
| `circleback` | Meeting intelligence | `search_meetings`, `search_transcripts` |

The `McpRegistry` returns the entries; the `McpConnector` and `McpClient` handle the actual transport.

## Built-in plugins

| Plugin id | Version | Description |
| --- | --- | --- |
| `superpowers` | 5.0.7 | Subagent development framework. |
| `frontend-design` | latest | Web UI implementation. |
| `code-review` | latest | Quality assurance. |
| `github` | latest | Repository management. |
| `context7` | latest | Documentation. |
| `playwright` | latest | Testing. |

Plugins are a higher-level capability bundle. They group skills and MCP servers so a planner can say "use the github plugin" instead of listing each tool.

## `ResultAggregator`

```typescript
import { ResultAggregator } from '@abhinav2203/codeflow-agent/agent';

const aggregator = new ResultAggregator(tasks, results);
const report = aggregator.toMarkdown();
// or
const json = aggregator.toJson();
```

`toMarkdown` produces a report with two sections: failed tasks (with the `verify` command, `done` description, and any error), and completed tasks (with the duration). `toJson` returns the same data structured for downstream tooling.

## CLI

```bash
codeflow-agent --plan path/to/plan.json
codeflow-agent --list-skills
codeflow-agent --list-mcp
codeflow-agent --list-plugins
```

The plan file is a JSON array of `AgentTask`s. The CLI runs them, prints the markdown report, exits 0 on full success or 1 if any task failed.

## File layout

```
codeflow-agent/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts              re-exports
    ├── agent/
    │   ├── agent-spawner.ts
    │   ├── task-queue.ts
    │   ├── result-aggregator.ts
    │   ├── execution-context.ts
    │   ├── blueprint.ts
    │   ├── types.ts
    │   └── prompts/          per-agent-type prompt templates
    ├── skills/
    │   ├── registry.ts
    │   └── loader.ts
    ├── mcp/
    │   ├── registry.ts
    │   ├── connector.ts
    │   └── client.ts
    ├── plugins/
    │   ├── registry.ts
    │   └── loader.ts
    ├── ai/
    │   ├── scaffold-utils.ts
    │   ├── scaffold-generator.ts
    │   ├── multi-language-codegen.ts
    │   ├── test-generator.ts
    │   ├── doc-generator.ts
    │   └── refactor-suggester.ts
    ├── cli/                  CLI entry
    ├── permissions/
    ├── store/
    ├── types/
    └── test/                 vitest specs
```
