/**
 * Type definitions for @abhinav2203/codeflow-execution
 * Runtime execution engine for CodeFlow blueprint graphs
 */

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
  logs?: LogEntry[];
  artifacts?: Artifact[];
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  source?: string;
}

export interface Artifact {
  type: 'file' | 'directory' | 'test-result';
  path: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface WorkspaceConfig {
  timeout: number;
  isolated: boolean;
  workingDirectory?: string;
  environment?: Record<string, string>;
  dependencies?: string[];
}

export interface ExecutionEngine {
  initialize(config?: Partial<WorkspaceConfig>): Promise<void>;
  execute(code: string, context?: any): Promise<ExecutionResult>;
  validate(code: string): Promise<{ valid: boolean; errors: string[] }>;
  test(code: string, testCases: TestCase[]): Promise<TestResult[]>;
  getConfig(): WorkspaceConfig;
}

export interface TestCase {
  input: any;
  expected: any;
  description?: string;
}

export interface TestResult {
  input: any;
  expected: any;
  actual: any;
  passed: boolean;
  duration?: number;
  error?: string;
}

export interface ExecutionContext {
  workspaceId: string;
  blueprintId?: string;
  userId?: string;
  variables: Record<string, any>;
  startTime: number;
}

export interface RuntimeMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  peakMemoryUsage?: number;
}