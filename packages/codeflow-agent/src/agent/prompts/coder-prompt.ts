import { skillRegistry } from '../../skills/registry.js';
import { mcpRegistry } from '../../mcp/registry.js';
import type { AgentTask } from '../types.js';

export interface CoderPromptOptions {
  task: AgentTask;
  projectContext: {
    rootPath: string;
    techStack: string[];
    conventions: string[];
  };
  skills?: string[];
  mcpServers?: string[];
}

export function buildCoderPrompt(options: CoderPromptOptions): string {
  const { task, projectContext, skills = [], mcpServers = [] } = options;

  const skillPrompt = skillRegistry.getPromptForTask(task.description, skills);
  const mcpPrompt = mcpServers.length > 0
    ? '\n## AVAILABLE MCP TOOLS\n' +
      mcpServers.map(id => {
        const server = mcpRegistry.get(id);
        return server ? `- **${server.name}**: ${server.description}\n  Tools: ${server.tools.join(', ')}` : '';
      }).filter(Boolean).join('\n') +
      '\nUse Skill tool to load required skills. Connect MCP servers before use.'
    : '';

  return `Implement task: ${task.name}

## Description
${task.description}

## Files to modify
${task.files.map(f => `- ${f}`).join('\n')}

## Verification
Run to verify completion:
${task.verify}

## Success criteria
${task.done}

## Project context
- Root: ${projectContext.rootPath}
- Stack: ${projectContext.techStack.join(', ')}
${projectContext.conventions.map(c => `- ${c}`).join('\n')}

${skillPrompt}
${mcpPrompt}

## Steps
1. Read existing code patterns
2. Implement the task
3. Run verification
4. Report completion

Focus on the task. Write clean code.`;
}

export const CODER_AGENT_SYSTEM_PROMPT = `You are a senior software engineer. Execute tasks precisely as specified. Write tests before implementation. Verify completion with the specified command.`;
