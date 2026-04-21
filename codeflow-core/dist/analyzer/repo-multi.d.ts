type RepoGraphPart = Omit<import("../schema/index.js").BlueprintGraph, "projectName" | "mode" | "generatedAt">;
export interface SourceSpanEntry {
    nodeId: string;
    filePath: string;
    startLine: number;
    endLine: number;
    symbol?: string;
}
export interface CallSiteEntry {
    edgeKey: string;
    fromNodeId: string;
    toNodeId: string;
    filePath: string;
    lineNumbers: number[];
    expressions: string[];
}
export interface RepoAnalysisResult extends RepoGraphPart {
    sourceSpans: Record<string, SourceSpanEntry>;
    callSites: Record<string, CallSiteEntry>;
}
export interface AnalyzeRepoOptions {
    excludePatterns?: string[];
}
export declare const analyzeRepo: (repoPath: string, options?: AnalyzeRepoOptions) => Promise<RepoAnalysisResult>;
export {};
