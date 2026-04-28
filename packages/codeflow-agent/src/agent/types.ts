export interface AgentTask {
  id: string;
  name: string;
  description: string;
  files: string[];
  verify: string;
  done: string;
  dependsOn: string[];
  skills?: string[];
  mcpServers?: string[];
  plugins?: string[];
  agentType?: 'coder' | 'reviewer' | 'tester' | 'planner' | 'researcher';
  model?: 'sonnet' | 'opus' | 'haiku';
  subagentPrompt?: string;
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: Record<string, string>;
  duration: number;
}

export interface AgentConfig {
  maxConcurrent?: number;
  maxRetries?: number;
  defaultModel?: 'sonnet' | 'opus' | 'haiku';
  defaultAgentType?: AgentTask['agentType'];
  workingDirectory?: string;
  capabilities?: CapabilityConfig;
}

export interface CapabilityConfig {
  skills: Skill[];
  mcpServers: McpServer[];
  plugins: Plugin[];
}

export interface TaskStatus {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: AgentResult;
  startedAt?: Date;
  completedAt?: Date;
}

export interface OrchestrationResult {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  results: AgentResult[];
  duration: number;
}

export interface Skill {
  name: string;
  description: string;
  enabled?: boolean;
}

export interface McpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface Plugin {
  name: string;
  version: string;
  enabled?: boolean;
}