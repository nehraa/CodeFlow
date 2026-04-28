#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { AgentSpawner } from '../agent/agent-spawner.js';
import { resultAggregator } from '../agent/result-aggregator.js';
import { TaskQueue } from '../agent/task-queue.js';
import { skillRegistry } from '../skills/registry.js';
import { mcpRegistry } from '../mcp/registry.js';
import { pluginRegistry } from '../plugins/registry.js';
import { CodeflowSessionStore } from '../store/session.js';
import { McpToolClient } from '../mcp/client.js';
import { executeWithContext, executeBlueprint, type ExecutionContext } from '../agent/execution-context.js';
import type { AgentTask, AgentConfig } from '../agent/types.js';
import type { BlueprintGraph } from '@abhinav2203/codeflow-core/schema';

interface CliOptions {
  planFile: string;
  blueprintFile: string;
  maxConcurrent?: number;
  model?: 'sonnet' | 'opus' | 'haiku';
  listSkills?: boolean;
  listMcp?: boolean;
  listPlugins?: boolean;
  serve?: boolean;
  acp?: boolean;
  port?: number;
  projectName?: string;
  mcpServerUrl?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    planFile: '',
    blueprintFile: '',
    maxConcurrent: 3,
    model: 'sonnet'
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--plan':
        options.planFile = args[++i];
        break;
      case '--blueprint':
        options.blueprintFile = args[++i];
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
      case '--serve':
        options.serve = true;
        break;
      case '--acp':
        options.acp = true;
        break;
      case '--port':
        options.port = parseInt(args[++i], 10);
        break;
      case '--project':
        options.projectName = args[++i];
        break;
      case '--mcp':
        options.mcpServerUrl = args[++i];
        break;
      default:
        if (!args[i].startsWith('--')) {
          options.planFile = args[i];
        }
    }
  }

  // Handle --serve flag (start opencode headless server)
  if (options.serve) {
    const port = options.port ?? 8080;
    console.log(`Starting opencode serve on port ${port}...`);
    const child = spawn('opencode', ['serve', '--port', String(port)], {
      stdio: 'inherit',
      detached: false,
    });
    child.on('error', (err) => {
      console.error('Failed to start opencode serve:', err.message);
      process.exit(1);
    });
    // Keep the process running
    await new Promise(() => {});
    return;
  }

  // Handle --acp flag (start ACP multi-agent server)
  if (options.acp) {
    const port = options.port ?? 8081;
    console.log(`Starting opencode ACP server on port ${port}...`);
    const child = spawn('opencode', ['acp', '--port', String(port)], {
      stdio: 'inherit',
      detached: false,
    });
    child.on('error', (err) => {
      console.error('Failed to start opencode acp:', err.message);
      process.exit(1);
    });
    // Keep the process running
    await new Promise(() => {});
    return;
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

  if (!options.planFile && !options.blueprintFile) {
    console.error('Error: --plan <file> or --blueprint <file> is required');
    console.log('\nUsage:');
    console.log('  codeflow-agent --list-skills        List available skills');
    console.log('  codeflow-agent --list-mcp          List available MCP servers');
    console.log('  codeflow-agent --list-plugins      List available plugins');
    console.log('  codeflow-agent --plan <file> [--project <name>] [--mcp <url>]');
    console.log('                  Execute a plan (optionally with session store + MCP)');
    console.log('  codeflow-agent --blueprint <file> [--project <name>]');
    console.log('                  Execute a blueprint graph');
    process.exit(1);
  }

  // Handle blueprint execution
  if (options.blueprintFile) {
    const projectName = options.projectName || 'codeflow-agent';
    const store = new CodeflowSessionStore();
    const mcp = new McpToolClient();
    const config: AgentConfig = {
      maxConcurrent: options.maxConcurrent,
      defaultModel: options.model
    };
    const spawner = new AgentSpawner(config);

    const ctx: ExecutionContext = {
      projectName,
      store,
      mcp,
      spawner
    };

    // Load blueprint file
    const blueprintContent = await readFile(options.blueprintFile, 'utf-8');
    const graph = JSON.parse(blueprintContent) as BlueprintGraph;

    console.log(`# Executing Blueprint\n`);
    console.log(`Project: ${projectName}`);
    console.log(`Total Nodes: ${graph.nodes.length}`);
    console.log(`Total Edges: ${graph.edges.length}`);
    console.log();

    const startTime = Date.now();
    const orchestrationResult = await executeBlueprint(ctx, {
      graph,
      workingDirectory: options.projectName ? process.cwd() : undefined
    });

    console.log(`\n# Results\n`);
    console.log(`Completed: ${orchestrationResult.completedTasks}/${orchestrationResult.totalTasks}`);
    console.log(`Failed: ${orchestrationResult.failedTasks}`);
    console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);

    if (orchestrationResult.failedTasks > 0) {
      console.log(resultAggregator.generateReport(orchestrationResult));
      process.exit(1);
    }
    return;
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
  console.log(`Max Concurrent: ${options.maxConcurrent}`);
  if (options.projectName) console.log(`Project: ${options.projectName}`);
  if (options.mcpServerUrl) console.log(`MCP Server: ${options.mcpServerUrl}`);
  console.log();

  const config: AgentConfig = {
    maxConcurrent: options.maxConcurrent,
    defaultModel: options.model
  };

  // When --project and/or --mcp are provided, use the full execution context
  if (options.projectName || options.mcpServerUrl) {
    const projectName = options.projectName || 'codeflow-agent';
    const store = new CodeflowSessionStore();
    const mcp = new McpToolClient();
    const spawner = new AgentSpawner(config);

    const ctx: ExecutionContext = {
      projectName,
      store,
      mcp,
      spawner
    };

    const startTime = Date.now();
    const orchestrationResult = await executeWithContext(ctx, {
      projectName,
      tasks: plan.tasks,
      mcpServerUrl: options.mcpServerUrl,
      maxConcurrent: options.maxConcurrent,
      model: options.model
    });

    console.log(`\n# Results\n`);
    console.log(`Completed: ${orchestrationResult.completedTasks}/${orchestrationResult.totalTasks}`);
    console.log(`Failed: ${orchestrationResult.failedTasks}`);
    console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);

    if (orchestrationResult.failedTasks > 0) {
      console.log(resultAggregator.generateReport(orchestrationResult));
      process.exit(1);
    }
    return;
  }

  // Legacy execution path (no session/MCP integration)
  const spawner = new AgentSpawner(config);
  const queue = new TaskQueue(plan.tasks);

  const startTime = Date.now();

  // Execute tasks
  const results = await spawner.executeWithQueue(plan.tasks, async (task) => {
    console.log(`[${task.id}] Starting: ${task.name}`);

    // Build context for the agent
    const context = {
      systemPrompt: `You are executing task: ${task.name}. ` +
        (task.agentType ? `Agent type: ${task.agentType}. ` : '') +
        'Follow the task description precisely and report completion.',
      userPrompt: task.description,
      model: task.model ?? options.model,
    };

    // Spawn the agent using opencode
    const result = await spawner.spawnAgent(task, context);

    if (result.success) {
      console.log(`[${task.id}] Completed: ${task.name}`);
      return result.output || `Task ${task.id} completed successfully`;
    } else {
      console.log(`[${task.id}] Failed: ${task.name} - ${result.error}`);
      throw new Error(result.error || 'Agent execution failed');
    }
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
