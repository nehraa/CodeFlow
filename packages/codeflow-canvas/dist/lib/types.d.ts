/**
 * Local type stubs for types referenced from @abhinav2203/codeflow-core
 * that are not yet available in the published package.
 * These should be replaced with proper imports when codeflow-core is updated.
 */
export type CycleReport = {
    cycles: Array<{
        nodeIds: string[];
        path: string[];
    }>;
    totalCycles: number;
};
export type SmellReport = {
    smells: Array<{
        nodeId: string;
        kind: string;
        message: string;
        severity: "error" | "warning" | "info";
    }>;
    totalSmells: number;
};
export type GraphMetrics = {
    totalNodes: number;
    totalEdges: number;
    avgDegree: number;
    maxDegree: number;
    density: number;
};
export type RefactorReport = {
    suggestions: Array<{
        nodeId: string;
        kind: string;
        description: string;
        effort: "low" | "medium" | "high";
    }>;
};
export type HealResult = {
    healed: boolean;
    nodeId?: string;
    fix?: string;
    error?: string;
};
export type OpencodeProvider = "anthropic" | "openai" | "google" | "azure" | "groq" | "mistral" | "cohere" | "perplexity" | "openrouter" | "bedrock" | "local";
export type OpencodeServerInfo = {
    status: "stopped" | "starting" | "running" | "error";
    url?: string;
    error?: string;
};
export interface SourceLocation {
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
    symbolName?: string;
}
//# sourceMappingURL=types.d.ts.map