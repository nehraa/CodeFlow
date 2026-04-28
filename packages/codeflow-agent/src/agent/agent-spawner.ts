import type { AgentConfig, AgentTask, AgentResult } from './types.js';
import { TaskQueue } from './task-queue.js';

export interface SpawnResult {
  taskId: string;
  success: boolean;
  output: string;
  error?: string;
}

export class AgentSpawner {
  private config: Required<AgentConfig>;

  constructor(config: AgentConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 3,
      maxRetries: config.maxRetries ?? 2,
      defaultModel: config.defaultModel ?? 'sonnet',
      defaultAgentType: config.defaultAgentType ?? 'coder',
      workingDirectory: config.workingDirectory ?? process.cwd(),
      capabilities: config.capabilities ?? { skills: [], mcpServers: [], plugins: [] },
    };
  }

  async spawnAgent(
    task: AgentTask,
    context: { systemPrompt?: string; userPrompt: string; model?: 'sonnet' | 'opus' | 'haiku' }
  ): Promise<SpawnResult> {
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

      if (readyTasks.length === 0) {
        const pending = queue.getPendingCount();
        if (pending > 0) {
          throw new Error('Circular dependency detected - no ready tasks but pending tasks exist');
        }
        break;
      }

      const toExecute = readyTasks.slice(0, this.config.maxConcurrent);
      const running: Promise<void>[] = [];

      for (const task of toExecute) {
        queue.markRunning(task.id);
        const p = this.executeTask(task, executeFn, results, queue);
        running.push(p);
      }

      await Promise.all(running);
    }

    return results;
  }

  private async executeTask(
    task: AgentTask,
    executeFn: (task: AgentTask) => Promise<string>,
    results: Map<string, AgentResult>,
    queue: TaskQueue
  ): Promise<void> {
    const startTime = Date.now();
    try {
      const output = await executeFn(task);
      const result: AgentResult = {
        taskId: task.id,
        success: true,
        output,
        duration: Date.now() - startTime,
      };
      results.set(task.id, result);
      queue.markCompleted(task.id, result);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const result: AgentResult = {
        taskId: task.id,
        success: false,
        error,
        duration: Date.now() - startTime,
      };
      results.set(task.id, result);
      queue.markCompleted(task.id, result);
    }
  }
}