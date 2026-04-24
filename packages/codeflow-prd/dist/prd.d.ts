import type { BlueprintEdge, BlueprintNode } from "@abhinav2203/codeflow-core/schema";
type PrdParseResult = {
    nodes: BlueprintNode[];
    edges: BlueprintEdge[];
    workflows: {
        name: string;
        steps: string[];
    }[];
    warnings: string[];
};
export declare const parsePrd: (prdText: string) => PrdParseResult;
export {};
//# sourceMappingURL=prd.d.ts.map