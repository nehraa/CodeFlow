/**
 * codeflow-execution wrapper
 * Runtime execution engine for CodeFlow blueprint graphs
 */
import type {
  ExecutionResult,
  WorkspaceConfig,
  ExecutionEngine,
  TestCase,
  TestResult,
} from '@/types/codeflow-execution';

// Re-export types
export type { ExecutionResult, WorkspaceConfig, TestCase, TestResult };

class ExecutionEngineImpl implements ExecutionEngine {
  private workspace: WorkspaceConfig = { timeout: 30000, isolated: true };
  private initialized: boolean = false;

  async initialize(config?: Partial<WorkspaceConfig>): Promise<void> {
    if (config) {
      this.workspace = { ...this.workspace, ...config };
    }
    this.initialized = true;
    console.log('[codeflow-execution] Engine initialized with config:', this.workspace);
  }

  async execute(code: string, context?: any): Promise<ExecutionResult> {
    if (!this.initialized) {
      await this.initialize();
    }
    const start = Date.now();
    try {
      // In a real implementation, this would execute code in an isolated workspace
      // For now, simulate execution
      const result = await simulateExecution(code, context);
      return {
        success: true,
        output: result,
        duration: Date.now() - start,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - start,
      };
    }
  }

  async validate(code: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (!code || code.trim().length === 0) {
      errors.push('Code cannot be empty');
    }

    // Check for syntax errors (simplified)
    const bracketCount = (code.match(/\{/g) || []).length - (code.match(/\}/g) || []).length;
    if (bracketCount !== 0) {
      errors.push('Unmatched brackets');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async test(code: string, testCases: TestCase[]): Promise<TestResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      const start = Date.now();
      try {
        const actual = await this.execute(code, testCase.input);
        const passed = JSON.stringify(actual.output) === JSON.stringify(testCase.expected);
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          actual: actual.output,
          passed,
          duration: Date.now() - start,
        });
      } catch (error: any) {
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          actual: undefined,
          passed: false,
          duration: Date.now() - start,
          error: error.message,
        });
      }
    }

    return results;
  }

  getConfig(): WorkspaceConfig {
    return { ...this.workspace };
  }
}

async function simulateExecution(code: string, context?: any): Promise<string> {
  // Simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, 100));

  // For demo purposes, return a formatted output
  if (code.includes('console.log')) {
    const matches = code.match(/console\.log\(['"](.*?)['"]\)/);
    return matches ? matches[1] : 'Code executed successfully';
  }

  return `Executed ${code.split('\n').length} lines`;
}

// Singleton
let runtime: ExecutionEngine | null = null;

export function getExecutionRuntime(): ExecutionEngine {
  if (!runtime) {
    runtime = new ExecutionEngineImpl();
  }
  return runtime;
}

// Convenience functions
export async function executeCode(code: string, context?: any): Promise<ExecutionResult> {
  const engine = getExecutionRuntime();
  return engine.execute(code, context);
}

export async function validateCode(code: string): Promise<{ valid: boolean; errors: string[] }> {
  const engine = getExecutionRuntime();
  return engine.validate(code);
}

export async function runTests(code: string, testCases: TestCase[]): Promise<TestResult[]> {
  const engine = getExecutionRuntime();
  return engine.test(code, testCases);
}