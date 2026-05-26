import { resultAggregator } from './result-aggregator.js';
import { blueprintToTasks } from './blueprint.js';
import { saveReasoningTrace, appendReasoningStep } from '../store/reasoning.js';
import { createSessionId } from '@abhinav2203/codeflow-store/session';
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
export async function executeWithContext(ctx, options) {
    const { tasks, mcpServerUrl } = options;
    // Discover MCP tools if server URL is provided
    let availableTools = [];
    if (mcpServerUrl) {
        try {
            const tools = await ctx.mcp.listTools(mcpServerUrl);
            availableTools = tools.map((t) => t.name);
            console.log(`[MCP] Discovered ${tools.length} tools: ${availableTools.join(', ')}`);
        }
        catch (err) {
            console.warn(`[MCP] Could not connect to ${mcpServerUrl}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // Execute tasks through the spawner queue
    const results = await ctx.spawner.executeWithQueue(tasks, async (task) => {
        // Inject MCP tool context into the agent prompt
        const mcpContext = availableTools.length > 0
            ? `\n\nAvailable MCP tools: ${availableTools.join(', ')}`
            : '';
        const result = await ctx.spawner.spawnAgent(task, {
            systemPrompt: `You are executing task: ${task.name}.${mcpContext}`,
            userPrompt: task.description,
            model: task.model
        });
        return result;
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
                    status: r.success ? 'completed' : 'blocked',
                    batchIndex: 0,
                    outputPaths: r.output ? [r.output] : [],
                    managedRegionIds: [],
                    message: r.error || (r.success ? 'Completed' : 'Failed'),
                    errors: r.success ? [] : [r.error || 'Unknown error'],
                    taskType: 'unknown'
                })),
                ownership: [],
                steps: [],
                artifacts: []
            });
        }
        catch (err) {
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
export async function executeBlueprint(ctx, options) {
    const tasks = blueprintToTasks(options.graph);
    const sessionId = ctx.sessionId || createSessionId();
    // Save initial reasoning trace for blueprint ingestion
    const trace = {
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
        return result;
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
                    status: r.success ? 'completed' : 'blocked',
                    batchIndex: 0,
                    outputPaths: r.output ? [r.output] : [],
                    managedRegionIds: [],
                    message: r.error || (r.success ? 'Completed' : 'Failed'),
                    errors: r.success ? [] : [r.error || 'Unknown error'],
                    taskType: 'unknown'
                })),
                ownership: [],
                steps: [],
                artifacts: []
            });
        }
        catch (err) {
            console.error(`[Session] Failed to save execution report: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return orchestrationResult;
}
