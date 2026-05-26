import type { AgentTask, OrchestrationResult } from './types.js';
import { AgentSpawner } from './agent-spawner.js';
import { CodeflowSessionStore } from '../store/session.js';
import { McpToolClient } from '../mcp/client.js';
import { type BlueprintOptions } from './blueprint.js';
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
export declare function executeWithContext(ctx: ExecutionContext, options: OrchestrationOptions): Promise<OrchestrationResult>;
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
export declare function executeBlueprint(ctx: ExecutionContext, options: BlueprintOptions): Promise<OrchestrationResult>;
//# sourceMappingURL=execution-context.d.ts.map