import type { AgentTask } from '../types.js';

export interface PlannerPromptOptions {
  goal: string;
  constraints: string[];
  existingFiles: string[];
}

export function buildPlannerPrompt(options: PlannerPromptOptions): string {
  const { goal, constraints, existingFiles } = options;

  return `You are a senior software architect specializing in task decomposition and dependency analysis.

## GOAL
${goal}

## EXISTING FILES
${existingFiles.map(f => `- ${f}`).join('\n')}

## CONSTRAINTS
${constraints.map(c => `- ${c}`).join('\n')}

## DECOMPOSITION APPROACH
1. **Identify independent tasks** - Tasks with no dependencies can run in parallel
2. **Identify sequential dependencies** - Task B needs Task A's output
3. **Define contracts** - What does each task's output look like?
4. **Assign to vertical slices** - Group related functionality together
5. **Define verification** - How to prove each task is complete?

## OUTPUT FORMAT
\`\`\`markdown
### Task N: [Task Name]

**Files:**
- Create: \`path/to/file.ts\`
- Modify: \`path/to/existing.ts:line-line\`

- [ ] **Step 1:** [Action]
- [ ] **Step 2:** [Action]

**Verification:** \`command to run\`
**Success Criteria:** [Measurable outcome]
\`\`\`

## MUST-HAVES
- Each task: 2-5 minutes of work
- Each task: specific files, specific actions
- Each task: verification command
- No placeholders (TBD, TODO, etc.)
- Complete code in every step

Follow YAGNI ruthlessly. Write the plan a senior engineer would need to implement without asking questions.`;
}

export const PLANNER_AGENT_SYSTEM_PROMPT = `You are a senior software architect with expertise in task decomposition, dependency analysis, and implementation planning. You break complex goals into bite-sized, executable tasks that can be implemented independently. You follow YAGNI, DRY, and SOLID principles.`;
