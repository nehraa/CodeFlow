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
export declare function buildCoderPrompt(options: CoderPromptOptions): string;
export declare const CODER_AGENT_SYSTEM_PROMPT = "You are a senior software engineer. Execute tasks precisely as specified. Write tests before implementation. Verify completion with the specified command.";
//# sourceMappingURL=coder-prompt.d.ts.map