import { describe, it, expect } from 'vitest';
import { TaskQueue } from './task-queue.js';
import { ResultAggregator, resultAggregator } from './result-aggregator.js';
import { AgentSpawner } from './agent-spawner.js';
import type { AgentTask, AgentResult } from './types.js';

describe('TaskQueue', () => {
  it('initializes with pending tasks', () => {
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: [] },
      { id: '2', name: 't2', description: '', files: [], verify: '', done: '', dependsOn: [] },
    ];
    const queue = new TaskQueue(tasks);
    expect(queue.getPendingCount()).toBe(2);
    expect(queue.getCompletedCount()).toBe(0);
  });

  it('getReadyTasks returns tasks with no dependencies', () => {
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: [] },
      { id: '2', name: 't2', description: '', files: [], verify: '', done: '', dependsOn: ['1'] },
    ];
    const queue = new TaskQueue(tasks);
    const ready = queue.getReadyTasks();
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('1');
  });

  it('getReadyTasks respects dependsOn', () => {
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: [] },
      { id: '2', name: 't2', description: '', files: [], verify: '', done: '', dependsOn: ['1'] },
    ];
    const queue = new TaskQueue(tasks);
    expect(queue.getReadyTasks().map((t) => t.id)).toEqual(['1']);

    queue.markCompleted('1', true, { taskId: '1', success: true, duration: 0 });
    expect(queue.getReadyTasks().map((t) => t.id)).toEqual(['2']);
  });

  it('markRunning and markCompleted update status correctly', () => {
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: [] },
    ];
    const queue = new TaskQueue(tasks);

    queue.markRunning('1');
    const status = queue.getStatus('1');
    expect(status?.status).toBe('running');
    expect(status?.startedAt).toBeDefined();

    queue.markCompleted('1', true, { taskId: '1', success: true, duration: 0 });
    const completed = queue.getStatus('1');
    expect(completed?.status).toBe('completed');
    expect(completed?.completedAt).toBeDefined();
  });

  it('isAllCompleted returns true when all done', () => {
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: [] },
      { id: '2', name: 't2', description: '', files: [], verify: '', done: '', dependsOn: [] },
    ];
    const queue = new TaskQueue(tasks);
    expect(queue.isAllCompleted()).toBe(false);

    queue.markCompleted('1', true, { taskId: '1', success: true, duration: 0 });
    expect(queue.isAllCompleted()).toBe(false);

    queue.markCompleted('2', true, { taskId: '2', success: true, duration: 0 });
    expect(queue.isAllCompleted()).toBe(true);
  });

  it('getResults returns completed results', () => {
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: [] },
    ];
    const queue = new TaskQueue(tasks);
    const result: AgentResult = { taskId: '1', success: true, output: 'ok', duration: 0 };
    queue.markCompleted('1', true, result);

    const results = queue.getResults();
    expect(results.get('1')).toBe(result);
  });

  it('getFailedCount returns correct count', () => {
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: [] },
      { id: '2', name: 't2', description: '', files: [], verify: '', done: '', dependsOn: [] },
      { id: '3', name: 't3', description: '', files: [], verify: '', done: '', dependsOn: [] },
    ];
    const queue = new TaskQueue(tasks);
    expect(queue.getFailedCount()).toBe(0);

    queue.markCompleted('1', true, { taskId: '1', success: true, duration: 0 });
    expect(queue.getFailedCount()).toBe(0);

    queue.markCompleted('2', false, { taskId: '2', success: false, error: 'fail', duration: 0 });
    expect(queue.getFailedCount()).toBe(1);

    queue.markCompleted('3', false, { taskId: '3', success: false, error: 'fail2', duration: 0 });
    expect(queue.getFailedCount()).toBe(2);
  });

  it('getReadyTasks ignores non-existent dependency task ID', () => {
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: ['999'] },
    ];
    const queue = new TaskQueue(tasks);
    // Task with non-existent dependency should not be ready since dependency is not completed
    const ready = queue.getReadyTasks();
    expect(ready).toHaveLength(0);
  });

  it('throws error on circular dependency detection', async () => {
    const spawner = new AgentSpawner({ maxConcurrent: 2 });
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: ['2'] },
      { id: '2', name: 't2', description: '', files: [], verify: '', done: '', dependsOn: ['1'] },
    ];

    const executeFn = async (task: AgentTask): Promise<string> => {
      return `executed ${task.id}`;
    };

    await expect(spawner.executeWithQueue(tasks, executeFn)).rejects.toThrow(
      'Circular dependency detected - no ready tasks but pending tasks exist'
    );
  });
});

describe('ResultAggregator', () => {
  it('aggregates results correctly', () => {
    const results = new Map<string, AgentResult>([
      ['1', { taskId: '1', success: true, duration: 10 }],
      ['2', { taskId: '2', success: false, error: 'fail', duration: 5 }],
      ['3', { taskId: '3', success: true, duration: 8 }],
    ]);

    const agg = new ResultAggregator();
    const result = agg.aggregate(results);

    expect(result.totalTasks).toBe(3);
    expect(result.completedTasks).toBe(2);
    expect(result.failedTasks).toBe(1);
    expect(result.duration).toBe(23);
  });

  it('getFailedTasks returns only failed', () => {
    const results = new Map<string, AgentResult>([
      ['1', { taskId: '1', success: true, duration: 10 }],
      ['2', { taskId: '2', success: false, error: 'fail', duration: 5 }],
    ]);

    const agg = new ResultAggregator();
    const failed = agg.getFailedTasks(results);

    expect(failed).toHaveLength(1);
    expect(failed[0].taskId).toBe('2');
  });

  it('getSuccessfulTasks returns only success', () => {
    const results = new Map<string, AgentResult>([
      ['1', { taskId: '1', success: true, duration: 10 }],
      ['2', { taskId: '2', success: false, error: 'fail', duration: 5 }],
    ]);

    const agg = new ResultAggregator();
    const success = agg.getSuccessfulTasks(results);

    expect(success).toHaveLength(1);
    expect(success[0].taskId).toBe('1');
  });

  it('generateReport produces markdown', () => {
    const results = new Map<string, AgentResult>([
      ['1', { taskId: '1', success: true, output: 'done', duration: 10 }],
      ['2', { taskId: '2', success: false, error: 'oops', duration: 5 }],
    ]);

    const agg = new ResultAggregator();
    const orchestration = agg.aggregate(results);
    const report = agg.generateReport(orchestration);

    expect(report).toContain('Total Tasks');
    expect(report).toContain('Failed Tasks');
    expect(report).toContain('Completed Tasks');
  });

  it('exports singleton instance', () => {
    expect(resultAggregator).toBeInstanceOf(ResultAggregator);
  });
});

describe('AgentSpawner', () => {
  it('uses default config values', () => {
    const spawner = new AgentSpawner();
    expect((spawner as any).config.maxConcurrent).toBe(3);
    expect((spawner as any).config.maxRetries).toBe(2);
    expect((spawner as any).config.defaultModel).toBe('sonnet');
  });

  it('accepts custom config', () => {
    const spawner = new AgentSpawner({ maxConcurrent: 5, defaultModel: 'opus' });
    expect((spawner as any).config.maxConcurrent).toBe(5);
    expect((spawner as any).config.defaultModel).toBe('opus');
  });

  it('spawnAgent returns failure result when opencode is not available', async () => {
    const spawner = new AgentSpawner();
    const task: AgentTask = { id: '1', name: 't', description: '', files: [], verify: '', done: '', dependsOn: [] };

    const result = await spawner.spawnAgent(task, { userPrompt: 'hello' });

    // opencode is not properly installed, so it should return a failure result
    expect(result.success).toBe(false);
    expect(result.taskId).toBe('1');
    expect(result.error).toBeDefined();
  });

  it('executeWithQueue runs tasks respecting dependencies', async () => {
    const spawner = new AgentSpawner({ maxConcurrent: 2 });
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: [] },
      { id: '2', name: 't2', description: '', files: [], verify: '', done: '', dependsOn: ['1'] },
    ];

    const executed: string[] = [];
    const executeFn = async (task: AgentTask): Promise<string> => {
      executed.push(task.id);
      return `executed ${task.id}`;
    };

    const results = await spawner.executeWithQueue(tasks, executeFn);

    expect(results.size).toBe(2);
    expect(results.get('1')?.success).toBe(true);
    expect(results.get('2')?.success).toBe(true);
    expect(executed).toContain('1');
    expect(executed).toContain('2');
  });

  it('executeWithQueue handles task failure', async () => {
    const spawner = new AgentSpawner();
    const tasks: AgentTask[] = [
      { id: '1', name: 't1', description: '', files: [], verify: '', done: '', dependsOn: [] },
    ];

    const executeFn = async (): Promise<string> => {
      throw new Error('boom');
    };

    const results = await spawner.executeWithQueue(tasks, executeFn);

    expect(results.get('1')?.success).toBe(false);
    expect(results.get('1')?.error).toBe('boom');
  });

  it('executeWithQueue respects maxConcurrent', async () => {
    let concurrent = 0;
    let maxConcurrentSeen = 0;

    const spawner = new AgentSpawner({ maxConcurrent: 3 });
    const tasks: AgentTask[] = Array.from({ length: 6 }, (_, i) => ({
      id: String(i + 1),
      name: `t${i + 1}`,
      description: '',
      files: [],
      verify: '',
      done: '',
      dependsOn: [],
    }));

    const executeFn = async (task: AgentTask): Promise<string> => {
      concurrent++;
      maxConcurrentSeen = Math.max(maxConcurrentSeen, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return `done ${task.id}`;
    };

    await spawner.executeWithQueue(tasks, executeFn);

    expect(maxConcurrentSeen).toBeLessThanOrEqual(3);
  });
});