import type { BlueprintGraph, BranchDiff, GraphBranch } from "@abhinav2203/codeflow-core/schema";
export declare const createBranchId: () => string;
/**
 * Snapshot the current graph into a named branch.
 * The graph is normalized through the schema so that all default values are applied.
 */
export declare const createBranch: ({ graph, name, description, parentBranchId }: {
    graph: BlueprintGraph;
    name: string;
    description?: string;
    parentBranchId?: string;
}) => GraphBranch;
/**
 * Compare two blueprint graphs and produce a structured diff.
 *
 * `base` is treated as the "before" snapshot (origin branch).
 * `compare` is treated as the "after" snapshot (the 'what if' branch).
 */
export declare const diffBranches: (base: BlueprintGraph, compare: BlueprintGraph, baseId?: string, compareId?: string) => BranchDiff;
//# sourceMappingURL=index.d.ts.map