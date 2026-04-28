import type { BranchDiff, GraphBranch } from "@abhinav2203/codeflow-core/schema";
export interface SearchBranchesOptions {
    projectName: string;
    query: string;
    limit?: number;
}
export interface BranchSearchResult {
    branchId: string;
    branchName: string;
    score: number;
    answer?: string;
}
export interface ExplainBranchDiffOptions {
    baseBranch: GraphBranch;
    compareBranch: GraphBranch;
    focusOn?: "nodes" | "edges" | "all";
}
/**
 * Natural language search across branches using CodeRAG.
 */
export declare const searchBranches: ({ projectName, query, limit }: SearchBranchesOptions) => Promise<BranchSearchResult[]>;
/**
 * Format a structural diff as human-readable text.
 */
export declare const formatStructuralDiff: (diff: BranchDiff, focusOn?: "nodes" | "edges" | "all") => string;
/**
 * Explain the differences between two branches using CodeRAG for natural language interpretation.
 */
export declare const explainBranchDiff: ({ baseBranch, compareBranch, focusOn }: ExplainBranchDiffOptions) => Promise<string>;
//# sourceMappingURL=search.d.ts.map