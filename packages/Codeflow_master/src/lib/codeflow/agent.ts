/**
 * codeflow-agent wrapper
 * Orchestration layer for subagent-driven development using Claude Code agents
 */
import type {
  AgentTask,
  AgentConfig,
  AgentStatus,
  AgentEvent,
  AgentOrchestrator,
  TaskResult,
} from '@/types/codeflow-agent';

// Re-export types
export type { AgentTask, AgentConfig, AgentStatus, AgentEvent, TaskResult };

type AgentEventCallback = (event: AgentEvent) => void;

class AgentOrchestratorImpl implements AgentOrchestrator {
  private agents: Map<string, AgentStatus> = new Map();
  private tasks: Map<string, AgentTask> = new Map();
  private callbacks: AgentEventCallback[] = [];
  private config: AgentConfig = {
    maxConcurrent: 3,
    timeout: 300000,
    retryAttempts: 2,
  };

  async initialize(config?: Partial<AgentConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    console.log('[codeflow-agent] Agent orchestrator initialized with config:', this.config);
  }

  registerAgent(id: string, name: string): void {
    this.agents.set(id, {
      id,
      name,
      status: 'idle',
      progress: 0,
    });
    this.emit({
      type: 'status_change',
      agentId: id,
      data: { status: 'idle' },
    });
  }

  async spawnAgent(id: string, name: string, task?: Partial<AgentTask>): Promise<void> {
    this.registerAgent(id, name);

    const agentStatus = this.agents.get(id)!;
    agentStatus.status = 'initializing';
    this.emit({
      type: 'status_change',
      agentId: id,
      data: { status: 'initializing' },
    });

    // Simulate initialization
    await new Promise((resolve) => setTimeout(resolve, 500));

    agentStatus.status = 'idle';
    this.emit({
      type: 'status_change',
      agentId: id,
      data: { status: 'idle' },
    });
  }

  async executeTask(agentId: string, task: AgentTask): Promise<any> {
    const agentStatus = this.agents.get(agentId);
    if (!agentStatus) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.tasks.set(task.id, task);
    agentStatus.currentTask = task.id;
    agentStatus.status = 'running';

    this.emit({
      type: 'task_start',
      agentId,
      data: { task },
    });

    try {
      // Simulate task execution with progress updates
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        agentStatus.progress = progress;
        this.emit({
          type: 'status_change',
          agentId,
          data: { progress },
        });
      }

      agentStatus.status = 'completed';
      agentStatus.progress = 100;

      this.emit({
        type: 'task_complete',
        agentId,
        data: { task, output: {} },
      });

      return { success: true, taskId: task.id };
    } catch (error: any) {
      agentStatus.status = 'error';
      this.emit({
        type: 'error',
        agentId,
        data: { error: error.message },
      });
      throw error;
    }
  }

  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): AgentStatus[] {
    return Array.from(this.agents.values());
  }

  onEvent(callback: AgentEventCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  async terminateAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'idle';
      agent.progress = 0;
      this.emit({
        type: 'status_change',
        agentId,
        data: { status: 'terminated' },
      });
    }
  }

  async terminateAll(): Promise<void> {
    for (const agent of this.agents.values()) {
      agent.status = 'idle';
      agent.progress = 0;
    }
    this.emit({
      type: 'status_change',
      agentId: 'all',
      data: { status: 'terminated' },
    });
  }

  private emit(event: AgentEvent): void {
    event.timestamp = Date.now();
    for (const callback of this.callbacks) {
      callback(event);
    }
  }
}

// Singleton
let orchestrator: AgentOrchestrator | null = null;

export function getAgentOrchestrator(): AgentOrchestrator {
  if (!orchestrator) {
    orchestrator = new AgentOrchestratorImpl();
  }
  return orchestrator;
}

// React hook for agent orchestration
export function useAgentOrchestrator() {
  const orch = getAgentOrchestrator();

  return {
    agents: orch.listAgents(),
    spawnAgent: (id: string, name: string, task?: Partial<AgentTask>) =>
      orch.spawnAgent(id, name, task ?? {}),
    executeTask: (agentId: string, task: AgentTask) => orch.executeTask(agentId, task),
    getAgentStatus: (agentId: string) => orch.getAgentStatus(agentId),
    terminateAgent: (agentId: string) => orch.terminateAgent(agentId),
    terminateAll: () => orch.terminateAll(),
    onEvent: (callback: AgentEventCallback) => orch.onEvent(callback),
  };
}

// Task queue management
export class TaskQueue {
  private queue: { task: AgentTask; priority: number }[] = [];

  enqueue(task: AgentTask, priority: number = 0): void {
    this.queue.push({ task, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): AgentTask | undefined {
    return this.queue.shift()?.task;
  }

  peek(): AgentTask | undefined {
    return this.queue[0]?.task;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}