import type { AgentTask } from '../types.js';
export interface TesterPromptOptions {
    task: AgentTask;
    implementationCode: string;
}
export declare function buildTesterPrompt(options: TesterPromptOptions): string;
export declare const TESTER_AGENT_SYSTEM_PROMPT = "You are a senior test engineer with expertise in TDD, test coverage analysis, and deterministic testing. You write tests that catch bugs, not just verify happy paths. You follow the AAA pattern (Arrange-Act-Assert) and ensure tests are independent and deterministic.";
//# sourceMappingURL=tester-prompt.d.ts.map