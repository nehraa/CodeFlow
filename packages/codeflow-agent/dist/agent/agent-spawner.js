import { execa } from 'execa';
import { TaskQueue } from './task-queue.js';
export class AgentSpawner {
    config;
    constructor(config = {}) {
        this.config = {
            maxConcurrent: config.maxConcurrent ?? 3,
            maxRetries: config.maxRetries ?? 2,
            defaultModel: config.defaultModel ?? 'sonnet',
            defaultAgentType: config.defaultAgentType ?? 'coder',
            workingDirectory: config.workingDirectory ?? process.cwd(),
            capabilities: config.capabilities ?? { skills: [], mcpServers: [], plugins: [] },
        };
    }
    /**
     * Spawns an agent execution using opencode CLI.
     * @throws Error if opencode is not installed or execution fails
     */
    async spawnAgent(task, context) {
        const startTime = Date.now();
        // Build the full prompt with system context
        const systemContext = context.systemPrompt ?? '';
        const fullPrompt = `${systemContext}\n\n${context.userPrompt}`.trim();
        // Build opencode command args
        const args = ['run', '--', fullPrompt];
        if (context.model) {
            args.push('--model', context.model);
        }
        // Pass agent type as context for the session
        if (task.agentType) {
            args.push('--session', `codeflow-${task.agentType}-${task.id}`);
        }
        try {
            const { stdout, stderr, exitCode } = await execa('opencode', args, {
                cwd: this.config.workingDirectory,
                timeout: 5 * 60 * 1000, // 5 min timeout
                encoding: 'utf8',
                stderr: 'pipe',
            });
            // Convert stdout/stderr to string (they can be string | Uint8Array | unknown[])
            const outputStr = typeof stdout === 'string' ? stdout : String(stdout);
            const errorStr = typeof stderr === 'string' ? stderr : (stderr ? String(stderr) : undefined);
            if (exitCode !== 0) {
                return {
                    taskId: task.id,
                    success: false,
                    output: outputStr,
                    error: errorStr || `opencode exited with code ${exitCode}`,
                };
            }
            return {
                taskId: task.id,
                success: true,
                output: outputStr,
            };
        }
        catch (err) {
            const execaError = err;
            if (execaError.failed) {
                const stdoutStr = typeof execaError.stdout === 'string' ? execaError.stdout : String(execaError.stdout);
                const stderrStr = typeof execaError.stderr === 'string' ? execaError.stderr : (execaError.stderr ? String(execaError.stderr) : undefined);
                return {
                    taskId: task.id,
                    success: false,
                    output: stdoutStr,
                    error: stderrStr || `opencode execution failed: ${execaError.message}`,
                };
            }
            // Check if opencode command was not found
            if (execaError.code === 'ENOENT') {
                return {
                    taskId: task.id,
                    success: false,
                    output: '',
                    error: 'opencode CLI not found. Please install opencode and ensure it is in your PATH.\n' +
                        'Installation: https://github.com/opencode-ai/opencode\n' +
                        'Or via: npm install -g opencode',
                };
            }
            throw err;
        }
    }
    async executeWithQueue(tasks, executeFn) {
        const queue = new TaskQueue(tasks);
        const results = new Map();
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
            const running = [];
            for (const task of toExecute) {
                queue.markRunning(task.id);
                const p = this.executeTask(task, executeFn, results, queue);
                running.push(p);
            }
            await Promise.all(running);
        }
        return results;
    }
    async executeTask(task, executeFn, results, queue) {
        let lastError;
        const maxRetries = this.config.maxRetries;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const startTime = Date.now();
            try {
                const spawnResult = await executeFn(task);
                const result = {
                    taskId: spawnResult.taskId,
                    success: spawnResult.success,
                    output: spawnResult.output,
                    error: spawnResult.error,
                    duration: spawnResult.duration ?? Date.now() - startTime,
                };
                results.set(task.id, result);
                queue.markCompleted(task.id, result.success, result);
                return;
            }
            catch (err) {
                lastError = err instanceof Error ? err.message : String(err);
                const result = {
                    taskId: task.id,
                    success: false,
                    error: lastError,
                    duration: Date.now() - startTime,
                };
                results.set(task.id, result);
                if (attempt < maxRetries) {
                    // Reset task to pending so it can be retried
                    const s = queue.getStatus(task.id);
                    if (s) {
                        s.status = 'pending';
                        s.startedAt = undefined;
                        s.completedAt = undefined;
                    }
                }
                else {
                    // Final failure
                    queue.markCompleted(task.id, result.success, result);
                }
            }
        }
    }
}
