import type { BlueprintGraph } from "../schema/index.js";
type RepoGraphPart = Omit<BlueprintGraph, "projectName" | "mode" | "generatedAt">;
export declare const analyzeTypeScriptRepo: (repoPath: string) => Promise<RepoGraphPart>;
export {};
