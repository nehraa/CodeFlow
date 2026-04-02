import type { BlueprintGraph, BlueprintNode } from "../schema/index.js";
export declare const isCodeBearingNode: (node: BlueprintNode) => boolean;
export declare const getNodeStubPath: (node: BlueprintNode) => string | null;
export declare const getNodeRuntimeExport: (node: BlueprintNode) => string | null;
export declare const generateNodeCode: (node: BlueprintNode, graph: BlueprintGraph) => string | null;
