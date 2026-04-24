import type { BlueprintEdge, BlueprintGraph, BlueprintNode, BlueprintNodeKind, CodeContract, ContractField, DesignCall, MethodSpec, SourceRef } from "@abhinav2203/codeflow-core/schema";
export declare const slugify: (value: string) => string;
export declare const createNodeId: (kind: BlueprintNodeKind, name: string, _pathHint?: string) => string;
export declare const mergeStringLists: (...collections: string[][]) => string[];
export declare const mergeFields: (...collections: ContractField[][]) => ContractField[];
export declare const mergeSourceRefs: (...collections: SourceRef[][]) => SourceRef[];
export declare const mergeDesignCalls: (...collections: DesignCall[][]) => DesignCall[];
export declare const mergeMethodSpecs: (...collections: MethodSpec[][]) => MethodSpec[];
export declare const mergeContracts: (...contracts: CodeContract[]) => CodeContract;
export declare const createNode: (input: Omit<BlueprintNode, "generatedRefs" | "traceRefs" | "traceState" | "status" | "specDraft" | "implementationDraft" | "lastVerification"> & Partial<Pick<BlueprintNode, "generatedRefs" | "traceRefs" | "traceState" | "status" | "specDraft" | "implementationDraft" | "lastVerification">>) => BlueprintNode;
export declare const dedupeEdges: (edges: BlueprintEdge[]) => BlueprintEdge[];
export declare const withSpecDrafts: (graph: BlueprintGraph) => BlueprintGraph;
//# sourceMappingURL=utils.d.ts.map