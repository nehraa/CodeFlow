import type { AgentTask, AgentResult, OrchestrationResult } from './types.js';
import { AgentSpawner } from './agent-spawner.js';
import { CodeflowSessionStore } from '../store/session.js';
import { McpToolClient } from '../mcp/client.js';
import { resultAggregator } from './result-aggregator.js';
import { blueprintToTasks, type BlueprintOptions } from './blueprint.js';
import { saveReasoningTrace, appendReasoningStep, type ReasoningTrace } from '../store/reasoning.js';
import { createSessionId } from '@abhinav2203/codeflow-store/session';

export interface ExecutionContext {
  projectName: string;
  sessionId?: string;
  store: CodeflowSessionStore;
  mcp: McpToolClient;
  spawner: AgentSpawner;
}

export interface OrchestrationOptions {
  projectName: string;
  tasks: AgentTask[];
  mcpServerUrl?: string;
  maxConcurrent?: number;
  model?: 'sonnet' | 'opus' | 'haiku';
  workingDirectory?: string;
}

/**
 * Execute a set of tasks using the provided execution context.
 *
 * This function:
 * 1. Optionally connects to an MCP server to discover available tools
 * 2. Executes tasks via the AgentSpawner queue
 * 3. Persists the execution report to the session store
 *
 * @returns Aggregated orchestration result with task outcomes
 */
export async function executeWithContext(
  ctx: ExecutionContext,
  options: OrchestrationOptions
): Promise<OrchestrationResult> {
  const { tasks, mcpServerUrl } = options;

  // Discover MCP tools if server URL is provided
  let availableTools: string[] = [];
  if (mcpServerUrl) {
    try {
      const tools = await ctx.mcp.listTools(mcpServerUrl);
      availableTools = tools.map((t) => t.name);
      console.log(`[MCP] Discovered ${tools.length} tools: ${availableTools.join(', ')}`);
    } catch (err) {
      console.warn(
        `[MCP] Could not connect to ${mcpServerUrl}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // Execute tasks through the spawner queue
  const results = await ctx.spawner.executeWithQueue(tasks, async (task) => {
    // Inject MCP tool context into the agent prompt
    const mcpContext =
      availableTools.length > 0
        ? `\n\nAvailable MCP tools: ${availableTools.join(', ')}`
        : '';

    const result = await ctx.spawner.spawnAgent(task, {
      systemPrompt: `You are executing task: ${task.name}.${mcpContext}`,
      userPrompt: task.description,
      model: task.model
    });

    return result.output || '';
  });

  const orchestrationResult = resultAggregator.aggregate(results);

  // Persist execution report to session
  if (ctx.sessionId && orchestrationResult.results.length > 0) {
    try {
      await ctx.store.updateExecutionReport(ctx.projectName, {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        results: orchestrationResult.results.map((r) => ({
          taskId: r.taskId,
          nodeId: r.taskId,
          status: r.success ? ('completed' as const) : ('blocked' as const),
          batchIndex: 0,
          outputPaths: r.output ? [r.output] : ([] as string[]),
          managedRegionIds: ([] as string[]),
          message: r.error || (r.success ? 'Completed' : 'Failed'),
          errors: r.success ? [] : [r.error || 'Unknown error'],
          taskType: 'unknown' as const
        })),
        ownership: [],
        steps: [],
        artifacts: []
      });
    } catch (err) {
      console.error(`[Session] Failed to save execution report: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return orchestrationResult;
}

/**
 * Execute a BlueprintGraph using the provided execution context.
 *
 * This function:
 * 1. Converts the BlueprintGraph to AgentTask[] using blueprintToTasks
 * 2. Saves an initial reasoning trace for blueprint ingestion
 * 3. Executes tasks with reasoning step tracking
 * 4. Persists execution report to the session store
 *
 * @returns Aggregated orchestration result with task outcomes
 */
export async function executeBlueprint(
  ctx: ExecutionContext,
  options: BlueprintOptions
): Promise<OrchestrationResult> {
  const tasks = blueprintToTasks(options.graph);
  const sessionId = ctx.sessionId || createSessionId();

  // Save initial reasoning trace for blueprint ingestion
  const trace: ReasoningTrace = {
    sessionId,
    phase: 'blueprint-ingestion',
    projectName: ctx.projectName,
    steps: [
      {
        agentId: 'orchestrator',
        thought: `Ingested blueprint with ${tasks.length} tasks`,
        action: 'blueprint_to_tasks',
        timestamp: new Date().toISOString(),
      },
    ],
    startedAt: new Date().toISOString(),
  };
  await saveReasoningTrace(ctx.projectName, trace);

  // Execute tasks with reasoning
  const results = await ctx.spawner.executeWithQueue(tasks, async (task) => {
    // Append task start reasoning step
    await appendReasoningStep(ctx.projectName, sessionId, 'execution', {
      agentId: task.agentType || 'coder',
      thought: `Starting task: ${task.name}`,
      action: 'task_start',
      timestamp: new Date().toISOString(),
    });

    const result = await ctx.spawner.spawnAgent(task, {
      systemPrompt: `You are executing task: ${task.name}.`,
      userPrompt: task.description,
      model: task.model,
    });

    // Append task completion reasoning step
    await appendReasoningStep(ctx.projectName, sessionId, 'execution', {
      agentId: task.agentType || 'coder',
      thought: `Completed task: ${task.name}`,
      action: result.success ? 'task_success' : 'task_failure',
      timestamp: new Date().toISOString(),
      output: result.output,
      error: result.error,
    });

    return result.output || '';
  });

  const orchestrationResult = resultAggregator.aggregate(results);

  // Persist execution report to session
  if (orchestrationResult.results.length > 0) {
    try {
      await ctx.store.updateExecutionReport(ctx.projectName, {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        results: orchestrationResult.results.map((r) => ({
          taskId: r.taskId,
          nodeId: r.taskId,
          status: r.success ? ('completed' as const) : ('blocked' as const),
          batchIndex: 0,
          outputPaths: r.output ? [r.output] : ([] as string[]),
          managedRegionIds: ([] as string[]),
          message: r.error || (r.success ? 'Completed' : 'Failed'),
          errors: r.success ? [] : [r.error || 'Unknown error'],
          taskType: 'unknown' as const
        })),
        ownership: [],
        steps: [],
        artifacts: []
      });
    } catch (err) {
      console.error(`[Session] Failed to save execution report: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return orchestrationResult;
}