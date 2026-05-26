import type { BlueprintGraph, BlueprintNode } from "@abhinav2203/codeflow-core";
/**
 * Generates scaffold code for a single blueprint node, dispatching to the
 * appropriate builder based on node kind. Returns null for non-code-bearing
 * nodes (e.g. "module").
 */
export declare const generateNodeCode: (node: BlueprintNode, graph: BlueprintGraph) => string | null;
//# sourceMappingURL=scaffold-generator.d.ts.map