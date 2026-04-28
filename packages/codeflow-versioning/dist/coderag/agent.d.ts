import type { QueryResult } from "@abhinav2203/coderag";
import type { BlueprintNode } from "@abhinav2203/codeflow-core/schema";
export type AgentRetrievalContext = {
    attempted: boolean;
    explicit: boolean;
    used: boolean;
    query: string | null;
    depth: number;
    result: QueryResult | null;
    warning: string | null;
};
type ResolveAgentRetrievalArgs = {
    node: BlueprintNode;
    relatedNodes: BlueprintNode[];
    instruction?: string;
    retrievalQuery?: string;
    retrievalDepth?: number;
    allowAutoQuery?: boolean;
};
export declare const buildAgentRetrievalQuery: ({ node, relatedNodes, instruction }: Pick<ResolveAgentRetrievalArgs, "node" | "relatedNodes" | "instruction">) => string;
export declare const formatAgentRetrievalPrompt: (result: QueryResult) => string;
export declare const formatAgentRetrievalNote: (context: AgentRetrievalContext) => string | null;
export declare function resolveAgentRetrievalContext({ node, relatedNodes, instruction, retrievalQuery, retrievalDepth, allowAutoQuery }: ResolveAgentRetrievalArgs): Promise<AgentRetrievalContext>;
export {};
//# sourceMappingURL=agent.d.ts.map