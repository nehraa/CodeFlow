export interface SkillEntry {
    id: string;
    name: string;
    path: string;
    triggerPhrases: string[];
    description: string;
    useCases: string[];
}
export declare const BUILTIN_SKILLS: SkillEntry[];
export declare class SkillRegistry {
    private skills;
    private triggerIndex;
    constructor(initialSkills?: SkillEntry[]);
    register(skill: SkillEntry): void;
    get(id: string): SkillEntry | undefined;
    findByTrigger(trigger: string): SkillEntry[];
    findByUseCase(useCase: string): SkillEntry[];
    list(): SkillEntry[];
    getPromptForTask(taskDescription: string, requiredSkills: string[]): string;
}
export declare const skillRegistry: SkillRegistry;
//# sourceMappingURL=registry.d.ts.map