import type { AgentTask } from '../types.js';
export interface ReviewerPromptOptions {
    task: AgentTask;
    codeToReview: string;
    skills?: string[];
}
export declare function buildReviewerPrompt(options: ReviewerPromptOptions): string;
export declare const REVIEWER_AGENT_SYSTEM_PROMPT = "You are a senior code reviewer with expertise in TypeScript, security, and performance. You provide thorough, constructive feedback that improves code quality without being pedantic. You focus on blockers, security issues, and correctness bugs.";
//# sourceMappingURL=reviewer-prompt.d.ts.map