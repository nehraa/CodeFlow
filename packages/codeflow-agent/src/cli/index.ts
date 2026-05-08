#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
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
import { generateBlueprint, buildNodePrompt, estimateNodeRisk, generateNodeCode } from '../ai/index.js';
import { PermissionManager } from '../ai/index.js';
import type { PermissionMode } from '../ai/index.js';

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
  // AI orchestration flags
  permission?: PermissionMode;
  generateBlueprint?: boolean;
  blueprintPrompt?: string;
  inspectPrompts?: boolean;
  nvidiaApiKey?: string;
  opencodeUrl?: string;
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
      // AI orchestration flags
      case '--permission':
        options.permission = args[++i] as PermissionMode;
        break;
      case '--generate':
        options.generateBlueprint = true;
        options.blueprintPrompt = args[++i];
        break;
      case '--inspect':
        options.inspectPrompts = true;
        break;
      case '--nvidia-api-key':
        options.nvidiaApiKey = args[++i];
        break;
      case '--opencode-url':
        options.opencodeUrl = args[++i];
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

  // Handle AI blueprint generation
  if (options.generateBlueprint) {
    const projectName = options.projectName || 'codeflow-project';
    const prompt = options.blueprintPrompt || 'build a user authentication system';

    console.log(`# Generating Blueprint\n`);
    console.log(`Project: ${projectName}`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Permission mode: ${options.permission || 'always-ask'}`);
    console.log();

    try {
      // Generate blueprint using NVIDIA Llama
      const blueprint = await generateBlueprint({
        prompt,
        projectName,
        mode: options.permission === 'yolo' ? 'yolo' : 'essential',
        nvidiaApiKey: options.nvidiaApiKey,
      });

      console.log(`Generated blueprint with ${blueprint.nodes.length} nodes and ${blueprint.edges.length} edges\n`);

      // Save blueprint to file
      const blueprintFile = `${projectName}-blueprint.json`;
      await writeFile(blueprintFile, JSON.stringify(blueprint, null, 2));
      console.log(`Saved blueprint to: ${blueprintFile}\n`);

      // Set up permission manager
      const permissionManager = new PermissionManager({
        mode: options.permission || 'always-ask',
      });

      // System prompt for code generation
      const systemPrompt = `You are an expert software engineer implementing blueprint nodes. Write clean, production-ready code following best practices.`;

      // Execute each node
      const results: Array<{ nodeId: string; success: boolean; error?: string; code?: string }> = [];

      for (const node of blueprint.nodes) {
        console.log(`\n--- Processing node: ${node.name} (${node.id}) ---`);

        // Build the implementation prompt
        const nodePrompt = buildNodePrompt({ graph: blueprint, node });
        const risk = estimateNodeRisk(node);

        console.log(`Risk level: ${risk}`);
        console.log(`Target file: ${node.path || 'N/A'}`);

        // Check if approval is needed
        const needsApproval = permissionManager.needsApproval(node.id, risk as 'low' | 'medium' | 'high');

        if (needsApproval) {
          console.log(`\n=== Approval Required ===`);
          console.log(`Node: ${node.name}`);
          console.log(`Risk: ${risk}`);

          if (options.inspectPrompts) {
            console.log(`\nPrompt:\n${nodePrompt}\n`);
          }

          // For now, we require explicit --permission=yolo to auto-approve
          // In always-ask/important modes, we'd prompt here
          console.log(`Add --permission=yolo to skip approvals`);
          console.log(`Skipping node ${node.id}`);
          results.push({ nodeId: node.id, success: false, error: 'Approval required' });
          continue;
        }

        try {
          // Generate code via OpenCode
          const code = await generateNodeCode({
            systemPrompt,
            userPrompt: nodePrompt,
            timeout: 120000,
          });

          console.log(`Generated ${code.length} characters of code`);

          // Save code to file if path is specified
          if (node.path) {
            await writeFile(node.path, code);
            console.log(`Saved to: ${node.path}`);
          }

          results.push({ nodeId: node.id, success: true, code });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to generate code for ${node.id}: ${errorMsg}`);
          results.push({ nodeId: node.id, success: false, error: errorMsg });
        }
      }

      // Print summary
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      console.log(`\n# Generation Summary\n`);
      console.log(`Total nodes: ${blueprint.nodes.length}`);
      console.log(`Successful: ${successful}`);
      console.log(`Failed: ${failed}`);

      if (failed > 0) {
        console.log(`\nFailed nodes:`);
        for (const r of results.filter((r) => !r.success)) {
          console.log(`  - ${r.nodeId}: ${r.error}`);
        }
        process.exit(1);
      }

      return;
    } catch (err) {
      console.error(`Blueprint generation failed:`, err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
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
    console.log('  codeflow-agent --generate "<prompt>" [--project <name>] [--permission <mode>]');
    console.log('                  Generate blueprint and code via AI');
    console.log('\nPermission modes:');
    console.log('  --permission=yolo       No approvals, auto-execute');
    console.log('  --permission=always-ask Approve every node (default)');
    console.log('  --permission=important  Only approve high-risk nodes');
    console.log('\nOther options:');
    console.log('  --inspect               Show prompts before generation');
    console.log('  --nvidia-api-key <key>  NVIDIA API key for blueprint generation');
    console.log('  --opencode-url <url>    OpenCode server URL (default: http://127.0.0.1:8080)');
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
    } else {
      console.log(`[${task.id}] Failed: ${task.name} - ${result.error}`);
    }

    return result;
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