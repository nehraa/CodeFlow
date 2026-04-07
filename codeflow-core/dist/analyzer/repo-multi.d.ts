type RepoGraphPart = Omit<import("../schema/index.js").BlueprintGraph, "projectName" | "mode" | "generatedAt">;
export interface AnalyzeRepoOptions {
    excludePatterns?: string[];
}
export declare const analyzeRepo: (repoPath: string, options?: AnalyzeRepoOptions) => Promise<RepoGraphPart>;
export {};
