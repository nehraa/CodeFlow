import type { BlueprintNode } from "@abhinav2203/codeflow-core";
/**
 * Returns true if the node produces code artifacts (all kinds except "module").
 */
export declare const isCodeBearingNode: (node: BlueprintNode) => boolean;
/**
 * Returns the relative path to the scaffold stub file for the given node,
 * or null if the node does not produce a code-bearing artifact.
 */
export declare const getNodeStubPath: (node: BlueprintNode) => string | null;
/**
 * Returns the relative path to the documentation file for the given node.
 */
export declare const getNodeDocPath: (node: BlueprintNode) => string;
/**
 * Returns the identifier that should be used when exporting this node's
 * runtime value (function name, class name, or null for other kinds).
 */
export declare const getNodeRuntimeExport: (node: BlueprintNode) => string | null;
//# sourceMappingURL=scaffold-utils.d.ts.map