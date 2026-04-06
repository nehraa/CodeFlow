import type { BlueprintEdge, BlueprintNodeKind } from "../schema/index.js";
interface ExtractedNode {
    nodeId: string;
    kind: BlueprintNodeKind;
    name: string;
    summary: string;
    path: string;
    signature: string;
    sourceRefs: Array<{
        kind: "repo";
        path: string;
        symbol?: string;
    }>;
    ownerId?: string;
}
export declare const extractNodesFromFile: (filePath: string, relativePath: string) => Promise<{
    nodes: ExtractedNode[];
    edges: BlueprintEdge[];
    symbolIndex: Map<string, string>;
    callEdges: Array<{
        fromId: string;
        toName: string;
        callText: string;
    }>;
    importEdges: Array<{
        fromModuleId: string;
        importPath: string;
    }>;
    inheritEdges: Array<{
        fromId: string;
        toName: string;
    }>;
}>;
export {};
