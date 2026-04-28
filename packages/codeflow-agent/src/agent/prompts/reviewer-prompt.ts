import { skillRegistry } from '../../skills/registry.js';
import { mcpRegistry } from '../../mcp/registry.js';
import type { AgentTask } from '../types.js';

export interface ReviewerPromptOptions {
  task: AgentTask;
  codeToReview: string;
  skills?: string[];
}

export function buildReviewerPrompt(options: ReviewerPromptOptions): string {
  const { task, codeToReview, skills = [] } = options;

  const skillPrompt = skillRegistry.getPromptForTask('code review', skills);

  return `You are a senior code reviewer specializing in correctness, security, and performance.

## TASK: ${task.name}
${task.description}

## CODE TO REVIEW
\`\`\`typescript
${codeToReview}
\`\`\`

${skillPrompt}

## REVIEW CRITERIA
1. **Correctness** - Does the code do what it claims?
2. **Security** - Any injection risks, hardcoded secrets, or validation gaps?
3. **Performance** - Any N+1 queries, unbounded loops, or memory leaks?
4. **Error Handling** - Are all error cases handled properly?
5. **Type Safety** - Proper TypeScript types, no \`any\` without justification?
6. **Code Style** - Follows DRY, KISS, SOLID principles?

## OUTPUT FORMAT
Provide your review in this structure:
\`\`\`markdown
## Issues Found

### [Severity] Issue Title
**File:** \`path/to/file.ts:line\`
**Problem:** Description
**Fix:** Suggested fix

## Approved / Changes Requested
\`\`\`

Be thorough but constructive. Focus on blockers, not style preferences.`;
}

export const REVIEWER_AGENT_SYSTEM_PROMPT = `You are a senior code reviewer with expertise in TypeScript, security, and performance. You provide thorough, constructive feedback that improves code quality without being pedantic. You focus on blockers, security issues, and correctness bugs.`;
