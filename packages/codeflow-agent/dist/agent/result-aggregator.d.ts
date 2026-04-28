import type { AgentResult, OrchestrationResult } from './types.js';
export declare class ResultAggregator {
    aggregate(results: Map<string, AgentResult>): OrchestrationResult;
    getFailedTasks(results: Map<string, AgentResult>): AgentResult[];
    getSuccessfulTasks(results: Map<string, AgentResult>): AgentResult[];
    generateReport(result: OrchestrationResult): string;
}
export declare const resultAggregator: ResultAggregator;
//# sourceMappingURL=result-aggregator.d.ts.map