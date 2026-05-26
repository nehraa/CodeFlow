import type { BlueprintGraph, BlueprintNode } from "@abhinav2203/codeflow-core";
export declare const isCodeBearingNode: (node: BlueprintNode) => boolean;
export declare const getNodeStubPath: (node: BlueprintNode) => string | null;
export declare const getNodeDocPath: (node: BlueprintNode) => string;
export declare const getNodeRuntimeExport: (node: BlueprintNode) => string | null;
export declare const generateNodeCode: (node: BlueprintNode, graph: BlueprintGraph) => string | null;
//# sourceMappingURL=codegen.d.ts.map