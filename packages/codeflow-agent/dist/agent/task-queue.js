export class TaskQueue {
    tasks = new Map();
    status = new Map();
    constructor(tasks) {
        for (const task of tasks) {
            this.tasks.set(task.id, task);
            this.status.set(task.id, {
                taskId: task.id,
                status: 'pending',
            });
        }
    }
    getTask(id) {
        return this.tasks.get(id);
    }
    getReadyTasks() {
        const ready = [];
        for (const [id, task] of this.tasks) {
            const s = this.status.get(id);
            if (s && s.status !== 'pending')
                continue;
            if (task.dependsOn.length === 0) {
                ready.push(task);
            }
            else {
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
    markRunning(taskId) {
        const s = this.status.get(taskId);
        if (s) {
            s.status = 'running';
            s.startedAt = new Date();
        }
    }
    markCompleted(taskId, success, result) {
        const s = this.status.get(taskId);
        if (s) {
            s.status = success ? 'completed' : 'failed';
            s.result = result;
            s.completedAt = new Date();
        }
    }
    isAllCompleted() {
        for (const s of this.status.values()) {
            if (s.status !== 'completed' && s.status !== 'failed') {
                return false;
            }
        }
        return true;
    }
    getResults() {
        const results = new Map();
        for (const [id, s] of this.status) {
            if (s.result) {
                results.set(id, s.result);
            }
        }
        return results;
    }
    getStatus(taskId) {
        return this.status.get(taskId);
    }
    getPendingCount() {
        let count = 0;
        for (const s of this.status.values()) {
            if (s.status === 'pending')
                count++;
        }
        return count;
    }
    getCompletedCount() {
        let count = 0;
        for (const s of this.status.values()) {
            if (s.status === 'completed')
                count++;
        }
        return count;
    }
    getFailedCount() {
        let count = 0;
        for (const s of this.status.values()) {
            if (s.status === 'failed')
                count++;
        }
        return count;
    }
}
