import type { ObservabilitySnapshot, TraceSpan, ObservabilityLog } from "@abhinav2203/codeflow-core/schema";
import type { GraphBranch } from "@abhinav2203/codeflow-core/schema";
export interface ObservabilitySearchResult {
    branchId: string;
    branchName: string;
    matchedSpans: TraceSpan[];
    matchedLogs: ObservabilityLog[];
    explanation: string;
}
/**
 * Format an observability snapshot as a searchable text document for CodeRAG.
 * Indexed by branch so CodeRAG can find execution traces.
 */
export declare const formatObservabilityForIndex: (branch: GraphBranch, snapshot: ObservabilitySnapshot) => string;
/**
 * Search observability data across branches.
 * Uses CodeRAG if available, otherwise returns empty array.
 */
export declare const searchObservability: ({ projectName, query, limit }: {
    projectName: string;
    query: string;
    limit?: number;
}) => Promise<ObservabilitySearchResult[]>;
/**
 * Explain observability data for a specific branch in natural language.
 */
export declare const explainBranchObservability: (branch: GraphBranch, focusOn?: "spans" | "logs" | "errors") => Promise<string>;
//# sourceMappingURL=observability.d.ts.map