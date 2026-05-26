import type { BlueprintEdge, BlueprintGraph, BlueprintNodeKind } from "@abhinav2203/codeflow-core/schema";
export declare const addNodeToGraph: (graph: BlueprintGraph, input: {
    kind: BlueprintNodeKind;
    name: string;
    summary?: string;
}) => BlueprintGraph;
export declare const addEdgeToGraph: (graph: BlueprintGraph, input: {
    from: string;
    to: string;
    kind: BlueprintEdge["kind"];
    label?: string;
}) => BlueprintGraph;
export declare const deleteNodeFromGraph: (graph: BlueprintGraph, nodeId: string) => BlueprintGraph;
//# sourceMappingURL=edit.d.ts.map