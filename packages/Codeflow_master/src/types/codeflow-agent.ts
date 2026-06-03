/**
 * Type definitions for @abhinav2203/codeflow-agent
 * Orchestration layer for subagent-driven development using Claude Code agents
 */

export interface SubAgent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  config?: AgentConfig;
}

export type AgentType = 'coder' | 'reviewer' | 'tester' | 'planner' | 'researcher' | 'debugger';
export type AgentStatusValue = 'idle' | 'initializing' | 'running' | 'completed' | 'error' | 'terminated';

export interface AgentTask {
  id: string;
  type: 'code' | 'review' | 'test' | 'research' | 'planning';
  description: string;
  input: any;
  output?: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgent?: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface AgentConfig {
  maxConcurrent?: number;
  timeout?: number;
  retryAttempts?: number;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: AgentStatusValue;
  progress: number;
  currentTask?: string;
  lastMessage?: string;
}

export interface AgentEvent {
  type: 'status_change' | 'task_start' | 'task_complete' | 'error' | 'message';
  agentId: string;
  data?: any;
  timestamp?: number;
}

export interface AgentOrchestrator {
  initialize(config?: Partial<AgentConfig>): Promise<void>;
  registerAgent(id: string, name: string): void;
  spawnAgent(id: string, name: string, task: Partial<AgentTask>): Promise<void>;
  executeTask(agentId: string, task: AgentTask): Promise<any>;
  getAgentStatus(agentId: string): AgentStatus | undefined;
  listAgents(): AgentStatus[];
  onEvent(callback: (event: AgentEvent) => void): () => void;
  terminateAgent(agentId: string): Promise<void>;
  terminateAll(): Promise<void>;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: any;
  error?: string;
  duration: number;
}

export interface TaskQueue {
  enqueue(task: AgentTask, priority?: number): void;
  dequeue(): AgentTask | undefined;
  peek(): AgentTask | undefined;
  size(): number;
  clear(): void;
}