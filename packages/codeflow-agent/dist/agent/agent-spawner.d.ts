import type { AgentConfig, AgentTask, AgentResult } from './types.js';
export interface SpawnResult {
    taskId: string;
    success: boolean;
    output: string;
    error?: string;
    duration?: number;
}
export declare class AgentSpawner {
    private config;
    constructor(config?: AgentConfig);
    /**
     * Spawns an agent execution using opencode CLI.
     * @throws Error if opencode is not installed or execution fails
     */
    spawnAgent(task: AgentTask, context: {
        systemPrompt?: string;
        userPrompt: string;
        model?: 'sonnet' | 'opus' | 'haiku';
    }): Promise<SpawnResult>;
    executeWithQueue(tasks: AgentTask[], executeFn: (task: AgentTask) => Promise<SpawnResult>): Promise<Map<string, AgentResult>>;
    private executeTask;
}
//# sourceMappingURL=agent-spawner.d.ts.map