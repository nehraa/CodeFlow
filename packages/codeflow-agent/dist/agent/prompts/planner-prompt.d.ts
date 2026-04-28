export interface PlannerPromptOptions {
    goal: string;
    constraints: string[];
    existingFiles: string[];
}
export declare function buildPlannerPrompt(options: PlannerPromptOptions): string;
export declare const PLANNER_AGENT_SYSTEM_PROMPT = "You are a senior software architect with expertise in task decomposition, dependency analysis, and implementation planning. You break complex goals into bite-sized, executable tasks that can be implemented independently. You follow YAGNI, DRY, and SOLID principles.";
//# sourceMappingURL=planner-prompt.d.ts.map