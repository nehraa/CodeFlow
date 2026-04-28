import type { AgentResult, OrchestrationResult } from './types.js';

export class ResultAggregator {
  aggregate(results: Map<string, AgentResult>): OrchestrationResult {
    let completedTasks = 0;
    let failedTasks = 0;
    let totalDuration = 0;

    for (const result of results.values()) {
      totalDuration += result.duration;
      if (result.success) {
        completedTasks++;
      } else {
        failedTasks++;
      }
    }

    return {
      totalTasks: results.size,
      completedTasks,
      failedTasks,
      results: Array.from(results.values()),
      duration: totalDuration,
    };
  }

  getFailedTasks(results: Map<string, AgentResult>): AgentResult[] {
    return Array.from(results.values()).filter((r) => !r.success);
  }

  getSuccessfulTasks(results: Map<string, AgentResult>): AgentResult[] {
    return Array.from(results.values()).filter((r) => r.success);
  }

  generateReport(result: OrchestrationResult): string {
    const lines: string[] = [
      '# Orchestration Result Report',
      '',
      `## Summary`,
      `- **Total Tasks**: ${result.totalTasks}`,
      `- **Completed**: ${result.completedTasks}`,
      `- **Failed**: ${result.failedTasks}`,
      `- **Duration**: ${result.duration}ms`,
      '',
    ];

    if (result.failedTasks > 0) {
      lines.push('## Failed Tasks');
      for (const r of result.results) {
        if (!r.success) {
          lines.push(`### Task: ${r.taskId}`);
          lines.push(`- **Error**: ${r.error ?? 'Unknown error'}`);
          lines.push('');
        }
      }
    }

    if (result.completedTasks > 0) {
      lines.push('## Completed Tasks');
      for (const r of result.results) {
        if (r.success) {
          lines.push(`- **${r.taskId}**: ${r.output ?? 'No output'}`);
        }
      }
    }

    return lines.join('\n');
  }
}

export const resultAggregator = new ResultAggregator();