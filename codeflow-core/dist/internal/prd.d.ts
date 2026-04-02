import type { BlueprintEdge, BlueprintNode, WorkflowPath } from "../schema/index.js";
type PrdParseResult = {
    nodes: BlueprintNode[];
    edges: BlueprintEdge[];
    workflows: WorkflowPath[];
    warnings: string[];
};
export declare const parsePrd: (prdText: string) => PrdParseResult;
export {};
