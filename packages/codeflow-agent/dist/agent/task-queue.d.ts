import type { AgentResult, AgentTask, TaskStatus } from './types.js';
export declare class TaskQueue {
    private tasks;
    private status;
    constructor(tasks: AgentTask[]);
    getTask(id: string): AgentTask | undefined;
    getReadyTasks(): AgentTask[];
    markRunning(taskId: string): void;
    markCompleted(taskId: string, success: boolean, result?: AgentResult): void;
    isAllCompleted(): boolean;
    getResults(): Map<string, TaskStatus['result']>;
    getStatus(taskId: string): TaskStatus | undefined;
    getPendingCount(): number;
    getCompletedCount(): number;
    getFailedCount(): number;
}
//# sourceMappingURL=task-queue.d.ts.map