import type { RiskReport } from "@abhinav2203/codeflow-core/schema";
import type { GraphBranch } from "@abhinav2203/codeflow-core/schema";
export interface RiskSearchResult {
    branch: GraphBranch;
    riskReport: RiskReport;
    relevanceScore: number;
    explanation: string;
}
/**
 * Format a risk report as searchable text for CodeRAG.
 */
export declare const formatRiskReportForIndex: (branch: GraphBranch) => string;
/**
 * Search branches by risk profile using CodeRAG.
 */
export declare const searchBranchesByRisk: ({ projectName, query, minScore, limit }: {
    projectName: string;
    query: string;
    minScore?: number;
    limit?: number;
}) => Promise<RiskSearchResult[]>;
/**
 * Explain the risk profile of a branch in natural language.
 */
export declare const explainBranchRisk: (branch: GraphBranch) => Promise<string>;
//# sourceMappingURL=risk.d.ts.map