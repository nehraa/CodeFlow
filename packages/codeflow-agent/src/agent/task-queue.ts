import type { AgentResult, AgentTask, TaskStatus } from './types.js';

export class TaskQueue {
  private tasks: Map<string, AgentTask> = new Map();
  private status: Map<string, TaskStatus> = new Map();

  constructor(tasks: AgentTask[]) {
    for (const task of tasks) {
      this.tasks.set(task.id, task);
      this.status.set(task.id, {
        taskId: task.id,
        status: 'pending',
      });
    }
  }

  getTask(id: string): AgentTask | undefined {
    return this.tasks.get(id);
  }

  getReadyTasks(): AgentTask[] {
    const ready: AgentTask[] = [];
    for (const [id, task] of this.tasks) {
      const s = this.status.get(id);
      if (s && s.status !== 'pending') continue;

      if (task.dependsOn.length === 0) {
        ready.push(task);
      } else {
        const allDepsCompleted = task.dependsOn.every((depId) => {
          const depStatus = this.status.get(depId);
          return depStatus && depStatus.status === 'completed';
        });
        if (allDepsCompleted) {
          ready.push(task);
        }
      }
    }
    return ready;
  }

  markRunning(taskId: string): void {
    const s = this.status.get(taskId);
    if (s) {
      s.status = 'running';
      s.startedAt = new Date();
    }
  }

  markCompleted(taskId: string, success: boolean, result?: AgentResult): void {
    const s = this.status.get(taskId);
    if (s) {
      s.status = success ? 'completed' : 'failed';
      s.result = result;
      s.completedAt = new Date();
    }
  }

  isAllCompleted(): boolean {
    for (const s of this.status.values()) {
      if (s.status !== 'completed' && s.status !== 'failed') {
        return false;
      }
    }
    return true;
  }

  getResults(): Map<string, TaskStatus['result']> {
    const results = new Map<string, TaskStatus['result']>();
    for (const [id, s] of this.status) {
      if (s.result) {
        results.set(id, s.result);
      }
    }
    return results;
  }

  getStatus(taskId: string): TaskStatus | undefined {
    return this.status.get(taskId);
  }

  getPendingCount(): number {
    let count = 0;
    for (const s of this.status.values()) {
      if (s.status === 'pending') count++;
    }
    return count;
  }

  getCompletedCount(): number {
    let count = 0;
    for (const s of this.status.values()) {
      if (s.status === 'completed') count++;
    }
    return count;
  }

  getFailedCount(): number {
    let count = 0;
    for (const s of this.status.values()) {
      if (s.status === 'failed') count++;
    }
    return count;
  }
}